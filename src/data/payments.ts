import "server-only";

import { db } from "@/prisma/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getGuestSessionForGroup } from "@/lib/auth/guest-session";
import { isValidToken } from "@/lib/auth/tokens";
import { parsePence, penceToDecimal } from "@/lib/expenses/money";
import { getLedgerForGroup } from "@/data/balances";
import type { PaymentAccess } from "@/lib/payments/types";
import { paymentCapacity } from "@/lib/payments/eligibility";
import { effectivePaymentPence } from "@/lib/payments/allocations";
import { formatPence } from "@/lib/expenses/money";

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
  const allowed = guest ? ["receiverMemberId", "amount", "requestKey", "allocations"] : ["payerMemberId", "receiverMemberId", "amount", "requestKey", "allocations"];
  if (Object.keys(values).some(key => !allowed.includes(key))) throw new PaymentError("The payment contains unsupported fields.");
  if (typeof values.requestKey !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(values.requestKey)) {
    throw new PaymentError("Reload the payment form before submitting.");
  }
  let amount: number;
  try { amount = parsePence(values.amount); }
  catch (error) { if (error instanceof RangeError) throw new PaymentError(error.message); throw error; }
  const allocations = parseAllocations(values.allocations);
  if (allocations.reduce((sum, row) => sum + row.amountPence, BigInt(0)) !== BigInt(amount)) throw new PaymentError("Expense allocations must equal the payment amount exactly.");
  return { payerMemberId: guest ? undefined : id(values.payerMemberId), receiverMemberId: id(values.receiverMemberId), amount: penceToDecimal(amount), requestKey: values.requestKey, allocations };
}

function parseAllocations(value: unknown) {
  if (!Array.isArray(value) || value.length > 500) throw new PaymentError("Choose the expenses this payment covers and enter their amounts.");
  const seen = new Set<number>();
  return value.map(row => {
    if (!row || typeof row !== "object" || Object.keys(row).some(key => !["expenseId", "amount"].includes(key))) throw new PaymentError("Enter valid expense allocations.");
    const expenseId = id(row.expenseId);
    if (seen.has(expenseId)) throw new PaymentError("Allocate to each expense only once.");
    seen.add(expenseId);
    try { return { expenseId, amountPence: BigInt(parsePence(row.amount)) }; }
    catch { throw new PaymentError("Each expense allocation must be a positive amount with at most two decimal places."); }
  }).sort((a, b) => a.expenseId - b.expenseId);
}

function validateAllocations(ledger: Ledger, allocations: ReturnType<typeof parseAllocations>, sender: number, receiver: number, excludeId?: number, historical = false) {
  for (const allocation of allocations) {
    const expense = ledger.paymentExpenses.find(expense => expense.id === allocation.expenseId);
    const share = expense?.shares.find(share => share.memberId === sender);
    if (!expense || expense.paidByMemberId !== receiver || !share) throw new PaymentError("Choose an existing expense in this group paid by the recipient and shared by the sender. Deleted expenses cannot receive new allocations.");
    if (historical) continue; // Reconciliation records known history, not a new transfer.
    let reserved = BigInt(0);
    for (const payment of ledger.payments) {
      if (payment.id === excludeId || payment.status === "REJECTED" || payment.payerMemberId !== sender) continue;
      for (const row of payment.allocations ?? []) if (row.expenseId === expense.id && !row.excluded) reserved += BigInt(row.amountPence);
    }
    if (reserved + allocation.amountPence > BigInt(parsePence(share.amount, true))) throw new PaymentError("An allocation exceeds this member's remaining expense share after confirmed and pending payments.");
  }
}

function sameAllocations(existing: { expenseId: number; amountPence: string }[], proposed: ReturnType<typeof parseAllocations>) {
  return existing.length === proposed.length && existing.every(row => proposed.some(other => other.expenseId === row.expenseId && other.amountPence === BigInt(row.amountPence)));
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
  const { debt, credit, availableDebt, availableCredit } = paymentCapacity(sender.net, receiver.net, ledger.payments, senderId, receiverId, excludeId);
  if (debt <= BigInt(0) || credit <= BigInt(0)) throw new PaymentError("The sender must currently owe money and the recipient must currently be owed money. Refresh the balances.");
  const proposed = BigInt(parsePence(amount));
  if (proposed > availableDebt || proposed > availableCredit) {
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
        || previous.payerMemberId !== payerMemberId || previous.receiverMemberId !== details.receiverMemberId || parsePence(previous.amount) !== parsePence(details.amount)
        || !sameAllocations(ledger.payments.find(row => row.id === previous.id)?.allocations ?? [], details.allocations)) {
        throw new PaymentError("This request was already used for different payment details. Reopen the payment form.");
      }
      return { id: previous.id, groupId: group.id, shareToken: group.shareToken, replay: true };
    }
    if (creationKind === "DIRECT" && ledger.payments.some(payment => payment.status === "SENT" && payment.payerMemberId === payerMemberId
      && payment.receiverMemberId === details.receiverMemberId
      && (effectivePaymentPence(payment) ?? BigInt(parsePence(payment.amount))) === BigInt(parsePence(details.amount)))) {
      throw new PaymentError("An equivalent payment is awaiting confirmation. Confirm that report in the payment history instead.");
    }
    await lockMembers(tx, group.id, [member.id, payerMemberId, details.receiverMemberId]);
    validateCapacity(ledger, payerMemberId, details.receiverMemberId, details.amount);
    validateAllocations(ledger, details.allocations, payerMemberId, details.receiverMemberId);
    const now = new Date().toISOString();
    const confirmed = creationKind === "DIRECT";
    const payment = await tx.orm.public.Payment.select("id").create({
      groupId: group.id, payerMemberId, receiverMemberId: details.receiverMemberId, amount: details.amount,
      requestKey: details.requestKey, creationKind, recordedByMemberId: member.id,
      reviewedByMemberId: confirmed ? member.id : null, reviewedAt: confirmed ? now : null,
      status: confirmed ? "CONFIRMED" : "SENT", createdAt: now, sentAt: now, confirmedAt: confirmed ? now : null,
    });
    for (const allocation of details.allocations) await tx.orm.public.PaymentAllocation.create({ paymentId: payment.id, ...allocation });
    await tx.orm.public.ActivityEvent.create({ groupId: group.id, memberId: member.id,
      eventType: confirmed ? "PAYMENT_RECORDED" : "PAYMENT_SENT", entityType: "PAYMENT", entityId: payment.id,
      description: `${member.name} ${confirmed ? "recorded a completed payment" : "reported a payment"} of £${details.amount}; allocations: ${details.allocations.map(row => `expense #${row.expenseId} (${ledger.paymentExpenses.find(expense => expense.id === row.expenseId)!.description}) £${formatPence(row.amountPence)}`).join(", ")}`, createdAt: now });
    return { id: payment.id, groupId: group.id, shareToken: group.shareToken, replay: false };
  });
}

export async function reviewPayment(access: PaymentAccess, paymentId: unknown, decision: unknown, expectedVersion?: string) {
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
    const effective = effectivePaymentPence(payment);
    if (decision === "confirm") {
      if (!expectedVersion || expectedVersion !== payment.allocationVersion) throw new PaymentError("This payment or its expenses changed. Refresh and review the remaining allocations before confirming.");
      if (effective === null) throw new PaymentError("Reconcile this historical payment's expense allocations before confirmation.");
      if (effective === BigInt(0)) throw new PaymentError("All allocations are excluded because their expenses were deleted. There is nothing to confirm.");
      const active = payment.allocations!.filter(row => !row.excluded).map(row => ({ expenseId: row.expenseId, amountPence: BigInt(row.amountPence) }));
      validateAllocations(ledger, active, payment.payerMemberId, payment.receiverMemberId, payment.id);
      validateCapacity(ledger, payment.payerMemberId, payment.receiverMemberId, formatPence(effective), payment.id);
    }
    const now = new Date().toISOString();
    const [updated] = await tx.orm.public.Payment.where({ id: payment.id, groupId: group.id, status: "SENT" }).select("id")
      .updateAll({ status, confirmedAt: decision === "confirm" ? now : null, reviewedAt: now, reviewedByMemberId: member.id });
    if (!updated) throw new PaymentError("This payment changed. Refresh the group before reviewing it.");
    await tx.orm.public.ActivityEvent.create({ groupId: group.id, memberId: member.id,
      eventType: decision === "confirm" ? "PAYMENT_CONFIRMED" : "PAYMENT_REJECTED", entityType: "PAYMENT", entityId: payment.id,
      description: `${member.name} ${decision === "confirm" ? "confirmed" : "rejected"} a payment of £${payment.amount}${decision === "confirm" ? `; £${formatPence(effective!)} applies to remaining expenses` : ""}`, createdAt: now });
    return { id: payment.id, groupId: group.id, shareToken: group.shareToken, replay: false };
  });
}

/** Owner-only explicit reconciliation. Frozen excluded allocations never move. */
export async function reconcilePayment(access: PaymentAccess, paymentId: unknown, expectedVersion: string, input: unknown) {
  if (access?.kind !== "owner") throw new PaymentError("Only the owner can reconcile payment allocations.");
  const target = id(paymentId);
  const allocations = parseAllocations(input);
  return db.transaction(async tx => {
    const { group, member, ledger } = await lockedAccess(access, tx);
    const payment = ledger.payments.find(row => row.id === target);
    if (!payment) throw new PaymentError("Payment not found in this group.");
    const identities = await tx.orm.public.GroupMember.where({ groupId: group.id }).where(row => row.id.in([payment.payerMemberId, payment.receiverMemberId])).select("id").all();
    if (payment.payerMemberId === payment.receiverMemberId || identities.length !== 2) throw new PaymentError("Both payment members must belong to this group before reconciliation.");
    const frozen = payment.allocations?.filter(row => row.excluded) ?? [];
    if (allocations.some(row => frozen.some(excluded => excluded.expenseId === row.expenseId))) throw new PaymentError("Excluded allocations cannot be reassigned or restored.");
    const combined = [...allocations, ...frozen.map(row => ({ expenseId: row.expenseId, amountPence: BigInt(row.amountPence) }))];
    if (combined.reduce((sum, row) => sum + row.amountPence, BigInt(0)) !== BigInt(parsePence(payment.amount))) throw new PaymentError("Active and excluded allocations must equal the original payment amount exactly.");
    if (payment.allocations?.length && sameAllocations(payment.allocations, combined)) return { groupId: group.id, shareToken: group.shareToken, replay: true };
    if (expectedVersion !== payment.allocationVersion) throw new PaymentError("The payment changed. Reopen reconciliation before saving.");
    validateAllocations(ledger, allocations, payment.payerMemberId, payment.receiverMemberId, payment.id, true);
    await lockMembers(tx, group.id, [member.id]);
    const rows = await tx.orm.public.PaymentAllocation.where({ paymentId: target }).all();
    for (const row of rows) if (!frozen.some(allocation => allocation.expenseId === row.expenseId)) await tx.orm.public.PaymentAllocation.where({ id: row.id }).delete();
    for (const allocation of allocations) await tx.orm.public.PaymentAllocation.create({ paymentId: target, ...allocation });
    await tx.orm.public.ActivityEvent.create({ groupId: group.id, memberId: member.id, eventType: "PAYMENT_RECONCILED", entityType: "PAYMENT", entityId: target,
      description: `${member.name} explicitly reconciled payment #${target}. Previous associations: ${(payment.allocations ?? []).map(row => `expense #${row.expenseId} £${formatPence(BigInt(row.amountPence))}${row.excluded ? " (excluded)" : ""}`).join(", ") || "unresolved"}. New active associations: ${allocations.map(row => `expense #${row.expenseId} (${ledger.paymentExpenses.find(expense => expense.id === row.expenseId)!.description}) £${formatPence(row.amountPence)}`).join(", ") || "none"}. Excluded allocations, original amount and status retained.`, createdAt: new Date().toISOString() });
    return { groupId: group.id, shareToken: group.shareToken, replay: false };
  });
}

export async function getPaymentReconciliation(groupId: number, paymentId: number) {
  return db.transaction(async tx => {
    const { ledger } = await lockedAccess({ kind: "owner", groupId }, tx);
    const payment = ledger.payments.find(row => row.id === paymentId);
    if (!payment) throw new PaymentError("Payment not found in this group.");
    return { payment, expenses: ledger.paymentExpenses.filter(expense => expense.paidByMemberId === payment.receiverMemberId && expense.shares.some(share => share.memberId === payment.payerMemberId)) };
  });
}
