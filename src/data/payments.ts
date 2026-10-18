import "server-only";

import { db } from "@/prisma/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getGuestSessionForGroup } from "@/lib/auth/guest-session";
import { isValidToken } from "@/lib/auth/tokens";
import { parsePence, penceToDecimal } from "@/lib/expenses/money";
import { getLedgerForGroup } from "@/data/balances";
import type { PaymentAccess } from "@/lib/payments/types";

type Client = Pick<typeof db, "orm">;
type Ledger = Awaited<ReturnType<typeof getLedgerForGroup>>;
export class PaymentError extends Error {}

function id(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2_147_483_647) {
    throw new PaymentError("Choose a valid group member or payment.");
  }
  return Number(value);
}

async function resolveAccess(access: PaymentAccess, tx: Client) {
  if (!access || !["owner", "guest"].includes(access.kind)) throw new PaymentError("Your group access is unavailable.");
  if (access.kind === "owner") {
    if (!Number.isInteger(access.groupId) || access.groupId <= 0 || access.groupId > 2_147_483_647) throw new PaymentError("Invalid group.");
    // Use the transaction connection, including after waiting for the group lock.
    const owner = await getCurrentUser(tx);
    const group = owner && await tx.orm.public.Group.select("id", "currency", "shareToken").first({ id: access.groupId, createdBy: owner.id });
    const member = group && await tx.orm.public.GroupMember.select("id", "name").first({ groupId: group.id, userId: owner!.id, role: "OWNER", isActive: true });
    if (group && member) return { group, member };
  } else if (isValidToken(access.shareToken)) {
    const group = await tx.orm.public.Group.select("id", "currency", "shareToken").first({ shareToken: access.shareToken });
    const guest = group && await getGuestSessionForGroup(group.id, tx);
    if (group && guest) return { group, member: guest.member };
  }
  throw new PaymentError("Your group access has expired or is unavailable. Reopen the group and try again.");
}

async function lockedAccess(access: PaymentAccess, tx: Client) {
  const initial = await resolveAccess(access, tx);
  if (initial.group.currency !== "GBP") throw new PaymentError("Repayments currently support GBP groups only.");
  const ledger = await getLedgerForGroup(initial.group.id, tx);
  // Revalidate sessions/ownership after the lock wait, before any write or replay.
  const resolved = await resolveAccess(access, tx);
  if (resolved.group.id !== initial.group.id) throw new PaymentError("The group has changed. Reopen it and try again.");
  return { ...resolved, ledger };
}

function validateCreation(input: unknown, guest: boolean) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PaymentError("Enter payment details.");
  const values = input as Record<string, unknown>;
  const allowed = guest ? ["receiverMemberId", "amount", "requestKey"] : ["payerMemberId", "receiverMemberId", "amount", "requestKey"];
  if (Object.keys(values).some(key => !allowed.includes(key))) throw new PaymentError("The payment contains unsupported fields.");
  if (typeof values.requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(values.requestKey)) {
    throw new PaymentError("Reload the payment form before submitting.");
  }
  let amount: number;
  try { amount = parsePence(values.amount); }
  catch (error) { if (error instanceof RangeError) throw new PaymentError(error.message); throw error; }
  return { payerMemberId: guest ? undefined : id(values.payerMemberId), receiverMemberId: id(values.receiverMemberId), amount: penceToDecimal(amount), requestKey: values.requestKey };
}

async function lockMembers(tx: Client, groupId: number, ids: number[]) {
  for (const memberId of [...new Set(ids)].sort((a, b) => a - b)) {
    const [member] = await tx.orm.public.GroupMember.where({ id: memberId, groupId, isActive: true }).select("id").updateAll({ isActive: true });
    if (!member) throw new PaymentError("New or confirmed payments require active members in this group. An inactive member's report can still be rejected.");
  }
}

/** Pending outgoing/incoming amounts reserve debt/credit independently. Exclude
 * the report being confirmed; it already owns that reservation. */
function validateCapacity(ledger: Ledger, senderId: number, receiverId: number, amount: string, excludeId?: number) {
  if (ledger.balances.status !== "ready") throw new PaymentError("Balances are unavailable. Resolve the ledger inconsistency before recording payments.");
  if (senderId === receiverId) throw new PaymentError("Sender and recipient must be different members.");
  const sender = ledger.balances.members.find(member => member.id === senderId);
  const receiver = ledger.balances.members.find(member => member.id === receiverId);
  if (!sender || !receiver) throw new PaymentError("Both members must belong to this group.");
  // These canonical aggregate strings may exceed the single-amount parser bound.
  const net = (value: string) => BigInt(value.replace(".", ""));
  const debt = -net(sender.net);
  const credit = net(receiver.net);
  if (debt <= BigInt(0) || credit <= BigInt(0)) throw new PaymentError("The sender must currently owe money and the recipient must currently be owed money. Refresh the balances.");
  let outgoing = BigInt(0), incoming = BigInt(0);
  for (const payment of ledger.payments) {
    if (payment.status !== "SENT" || payment.id === excludeId) continue;
    if (payment.payerMemberId === senderId) outgoing += BigInt(parsePence(payment.amount));
    if (payment.receiverMemberId === receiverId) incoming += BigInt(parsePence(payment.amount));
  }
  const proposed = BigInt(parsePence(amount));
  if (proposed > debt - outgoing || proposed > credit - incoming) {
    throw new PaymentError("This amount exceeds the available debt or credit after other awaiting-confirmation reports. Review pending reports and current balances; the amount has not been changed.");
  }
}

export async function createPayment(access: PaymentAccess, input: unknown) {
  const details = validateCreation(input, access?.kind === "guest");
  return db.transaction(async tx => {
    const { group, member, ledger } = await lockedAccess(access, tx);
    const payerMemberId = access.kind === "guest" ? member.id : details.payerMemberId!;
    const creationKind = access.kind === "guest" ? "REPORT" : "DIRECT";
    const previous = await tx.orm.public.Payment.select("id", "groupId", "payerMemberId", "receiverMemberId", "amount", "recordedByMemberId", "creationKind")
      .first({ requestKey: details.requestKey });
    if (previous) {
      if (previous.groupId !== group.id || previous.recordedByMemberId !== member.id || previous.creationKind !== creationKind
        || previous.payerMemberId !== payerMemberId || previous.receiverMemberId !== details.receiverMemberId || parsePence(previous.amount) !== parsePence(details.amount)) {
        throw new PaymentError("This request was already used for different payment details. Reopen the payment form.");
      }
      return { id: previous.id, groupId: group.id, shareToken: group.shareToken, replay: true };
    }
    if (creationKind === "DIRECT" && ledger.payments.some(payment => payment.status === "SENT" && payment.payerMemberId === payerMemberId
      && payment.receiverMemberId === details.receiverMemberId && parsePence(payment.amount) === parsePence(details.amount))) {
      throw new PaymentError("An equivalent payment is awaiting confirmation. Confirm that report in the payment history instead.");
    }
    await lockMembers(tx, group.id, [member.id, payerMemberId, details.receiverMemberId]);
    validateCapacity(ledger, payerMemberId, details.receiverMemberId, details.amount);
    const now = new Date().toISOString();
    const confirmed = creationKind === "DIRECT";
    const payment = await tx.orm.public.Payment.select("id").create({
      groupId: group.id, payerMemberId, receiverMemberId: details.receiverMemberId, amount: details.amount,
      requestKey: details.requestKey, creationKind, recordedByMemberId: member.id,
      reviewedByMemberId: confirmed ? member.id : null, reviewedAt: confirmed ? now : null,
      status: confirmed ? "CONFIRMED" : "SENT", createdAt: now, sentAt: now, confirmedAt: confirmed ? now : null,
    });
    await tx.orm.public.ActivityEvent.create({ groupId: group.id, memberId: member.id,
      eventType: confirmed ? "PAYMENT_RECORDED" : "PAYMENT_SENT", entityType: "PAYMENT", entityId: payment.id,
      description: `${member.name} ${confirmed ? "recorded a completed payment" : "reported a payment"} of £${details.amount}`, createdAt: now });
    return { id: payment.id, groupId: group.id, shareToken: group.shareToken, replay: false };
  });
}

export async function reviewPayment(access: PaymentAccess, paymentId: unknown, decision: unknown) {
  if (access?.kind !== "owner") throw new PaymentError("Only the group owner can confirm or reject payments.");
  const targetId = id(paymentId);
  if (decision !== "confirm" && decision !== "reject") throw new PaymentError("Choose confirm or reject.");
  return db.transaction(async tx => {
    const { group, member, ledger } = await lockedAccess(access, tx);
    const payment = ledger.payments.find(row => row.id === targetId);
    if (!payment) throw new PaymentError("Payment not found in this group.");
    const status = decision === "confirm" ? "CONFIRMED" : "REJECTED";
    if (payment.status === status) return { id: payment.id, groupId: group.id, shareToken: group.shareToken, replay: true };
    if (payment.status !== "SENT") throw new PaymentError("This payment has already been reviewed. Refresh the group.");
    await lockMembers(tx, group.id, decision === "confirm" ? [member.id, payment.payerMemberId, payment.receiverMemberId] : [member.id]);
    if (decision === "confirm") validateCapacity(ledger, payment.payerMemberId, payment.receiverMemberId, payment.amount, payment.id);
    const now = new Date().toISOString();
    const [updated] = await tx.orm.public.Payment.where({ id: payment.id, groupId: group.id, status: "SENT" }).select("id")
      .updateAll({ status, confirmedAt: decision === "confirm" ? now : null, reviewedAt: now, reviewedByMemberId: member.id });
    if (!updated) throw new PaymentError("This payment changed. Refresh the group before reviewing it.");
    await tx.orm.public.ActivityEvent.create({ groupId: group.id, memberId: member.id,
      eventType: decision === "confirm" ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED", entityType: "PAYMENT", entityId: payment.id,
      description: `${member.name} ${decision === "confirm" ? "confirmed" : "rejected"} a payment of £${payment.amount}`, createdAt: now });
    return { id: payment.id, groupId: group.id, shareToken: group.shareToken, replay: false };
  });
}
