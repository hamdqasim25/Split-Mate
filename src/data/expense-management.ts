import "server-only";

import { createHash } from "node:crypto";
import { db } from "@/prisma/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ExpenseError, validateExpenseInput } from "@/data/expenses";
import { getLedgerForGroup } from "@/data/balances";
import { effectivePaymentPence } from "@/lib/payments/allocations";
import { equalSplit, parsePence, penceToDecimal } from "@/lib/expenses/money";
import type { ExpenseFormContext, ExpenseInput } from "@/lib/expenses/types";

type Client = Pick<typeof db, "orm">;
const unavailable = "This expense or your owner access is unavailable. Reopen the group.";
const conflict = "This expense changed since you opened it. Reopen the expense to review the latest version before trying again.";
function validId(id: number) { return Number.isInteger(id) && id > 0 && id <= 2_147_483_647; }

async function ownerAccess(groupId: number, tx: Client) {
  if (!validId(groupId)) throw new ExpenseError(unavailable);
  const user = await getCurrentUser(tx);
  const group = user && await tx.orm.public.Group.select("id", "name", "currency", "shareToken").first({ id: groupId, createdBy: user.id });
  const member = group && await tx.orm.public.GroupMember.select("id", "name").first({ groupId, userId: user!.id, role: "OWNER", isActive: true });
  if (!group || !member) throw new ExpenseError(unavailable);
  return { group, member };
}

async function load(groupId: number, expenseId: number, tx: Client) {
  if (!validId(expenseId)) throw new ExpenseError(unavailable);
  await ownerAccess(groupId, tx);
  const [locked] = await tx.orm.public.Group.where({ id: groupId, currency: "GBP" }).select("id").updateAll({ currency: "GBP" });
  if (!locked) throw new ExpenseError("Expense changes currently support GBP groups only.");
  // Recheck the session and ownership after waiting, using this connection.
  const access = await ownerAccess(groupId, tx);
  const expense = await tx.orm.public.Expense.where({ id: expenseId, groupId }).first();
  const shares = expense ? await tx.orm.public.ExpenseParticipant.where({ expenseId }).orderBy(row => row.memberId.asc()).all() : [];
  const [event] = await tx.orm.public.ActivityEvent.where({ groupId, entityType: "EXPENSE", entityId: expenseId })
    .orderBy(row => row.id.desc()).limit(1).all();
  // Including the audit revision prevents ABA (edit, restore, stale save).
  // Every mutation below appends an event under the same group lock.
  const version = createHash("sha256").update(JSON.stringify([expense, shares, event?.id ?? null])).digest("hex");
  return { ...access, expense, shares, version, event };
}

async function contextFor(saved: Awaited<ReturnType<typeof load>>, tx: Client): Promise<ExpenseFormContext> {
  if (!saved.expense) throw new ExpenseError(unavailable);
  const members = await tx.orm.public.GroupMember.where({ groupId: saved.group.id })
    .select("id", "name", "isActive").orderBy([row => row.addedAt.asc(), row => row.id.asc()]).all();
  return { group: { name: saved.group.name, currency: saved.group.currency }, currentMember: saved.member,
    members: members.filter(member => member.isActive || member.id === saved.expense!.paidByMemberId || saved.shares.some(share => share.memberId === member.id))
      .map(member => ({ ...member, payerEligible: member.isActive || member.id === saved.expense!.paidByMemberId,
        participantEligible: member.isActive || saved.shares.some(share => share.memberId === member.id) })),
  };
}

export async function getSavedExpenseForOwner(groupId: number, expenseId: number) {
  return db.transaction(async tx => {
    const saved = await load(groupId, expenseId, tx);
    if (!saved.expense || saved.expense.deletedAt) throw new ExpenseError(unavailable);
    const input: ExpenseInput = { description: saved.expense.description, amount: saved.expense.amount,
      paidByMemberId: String(saved.expense.paidByMemberId), participantIds: saved.shares.map(row => String(row.memberId)),
      shares: saved.shares.map(row => ({ memberId: String(row.memberId), amount: row.amountOwed })) };
    validateExpenseInput(input);
    const context = await contextFor(saved, tx);
    if (!context.members.some(member => member.id === saved.expense!.paidByMemberId) || saved.shares.some(share => !context.members.some(member => member.id === share.memberId))) throw new ExpenseError(unavailable);
    return { context, input, version: saved.version };
  });
}

function checkVersion(expected: string, actual: string) {
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected) || expected !== actual) throw new ExpenseError(conflict);
}

async function prepare(groupId: number, expenseId: number, version: string, input: ExpenseInput, tx: Client, saving: boolean) {
  const saved = await load(groupId, expenseId, tx);
  if (!saved.expense || saved.expense.deletedAt) throw new ExpenseError("This expense has been deleted. Return to the group.");
  checkVersion(version, saved.version);
  // Review accepts unbalanced raw shares so the shared UI can show the remainder.
  // Save always validates the exact allocation, including duplicates and money.
  const details = validateExpenseInput(saving ? input : { ...input, shares: undefined });
  if (saving && !details.shares) throw new ExpenseError("Enter exactly one share for each participant.");
  const context = await contextFor(saved, tx);
  const payer = context.members.find(member => member.id === details.payerId && member.payerEligible);
  if (!payer || details.ids.some(id => !context.members.some(member => member.id === id && member.participantEligible))) throw new ExpenseError("Choose active group members, or retain the expense's existing inactive members in their original roles.");
  if (saving) {
    for (const id of [...new Set([saved.member.id, details.payerId, ...details.ids])].sort((a, b) => a - b)) {
      const member = context.members.find(member => member.id === id)!;
      const [locked] = await tx.orm.public.GroupMember.where({ id, groupId, isActive: member.isActive! }).select("id").updateAll({ isActive: member.isActive! });
      if (!locked) throw new ExpenseError("A member has changed. Review the expense again.");
    }
  }
  const equal = new Map(equalSplit(details.totalPence, details.ids).map(row => [row.memberId, penceToDecimal(row.pence)]));
  const participants = context.members.filter(member => details.ids.includes(member.id)).map(member => ({ id: member.id, name: member.name, amount: equal.get(member.id)! }));
  return { saved, details, review: { description: details.input.description, amount: details.input.amount, payer: { id: payer.id, name: payer.name }, participants } };
}

export async function previewSavedExpense(groupId: number, expenseId: number, version: string, input: ExpenseInput) {
  return db.transaction(async tx => {
    const { details, review } = await prepare(groupId, expenseId, version, input, tx, false);
    return { input: { ...details.input, shares: details.input.participantIds.map(memberId => ({ memberId,
      amount: input.shares?.find(share => share.memberId === memberId)?.amount ?? "0.00" })) }, review };
  });
}

export async function updateSavedExpense(groupId: number, expenseId: number, version: string, input: ExpenseInput) {
  return db.transaction(async tx => {
    const { saved, details, review } = await prepare(groupId, expenseId, version, input, tx, true);
    const shares = details.shares!;
    const ledger = await getLedgerForGroup(groupId, tx);
    const financialChange = saved.expense!.paidByMemberId !== details.payerId || parsePence(saved.expense!.amount) !== details.totalPence
      || saved.shares.length !== shares.size || saved.shares.some(share => shares.get(share.memberId) !== parsePence(share.amountOwed, true));
    if (financialChange && ledger.payments.some(payment => payment.status !== "REJECTED" && !payment.allocations?.length)) {
      throw new ExpenseError("Reconcile historical payments in Payment history before changing the payer, participants or amounts. Their expenses are not yet known.");
    }
    const allocatedBySender = new Map<number, bigint>();
    for (const payment of ledger.payments) {
      if (payment.status === "REJECTED") continue;
      for (const allocation of payment.allocations ?? []) {
        if (allocation.expenseId !== expenseId) continue;
        if (payment.receiverMemberId !== details.payerId || !shares.has(payment.payerMemberId)) throw new ExpenseError("This change would invalidate a payment association. Resolve its allocations in Payment history first; payments are never moved automatically.");
        allocatedBySender.set(payment.payerMemberId, (allocatedBySender.get(payment.payerMemberId) ?? BigInt(0)) + BigInt(allocation.amountPence));
      }
    }
    if (financialChange && [...allocatedBySender].some(([sender, amount]) => amount > BigInt(shares.get(sender)!))) throw new ExpenseError("A proposed share is below its confirmed or pending payments. Resolve those payment allocations in Payment history before reducing the share.");
    const splitMethod = review.participants.every(member => shares.get(member.id) === parsePence(member.amount, true)) ? "EQUAL" : "CUSTOM";
    await tx.orm.public.Expense.where({ id: expenseId, groupId }).updateAll({ description: review.description, amount: review.amount, paidByMemberId: review.payer.id, splitMethod });
    // Delete by unique ID: the pinned ORM's single-row delete requires this.
    for (const share of saved.shares) await tx.orm.public.ExpenseParticipant.where({ id: share.id }).delete();
    const now = new Date().toISOString();
    for (const [memberId, amount] of shares) await tx.orm.public.ExpenseParticipant.create({ expenseId, memberId, amountOwed: penceToDecimal(amount), createdAt: now });
    const before = saved.expense!;
    const changes = [before.description !== review.description ? `renamed from "${before.description}"` : "",
      parsePence(before.amount) !== details.totalPence ? `total £${before.amount} → £${review.amount}` : "",
      before.paidByMemberId !== review.payer.id ? `payer changed to ${review.payer.name}` : "",
      `shares: ${review.participants.map(member => `${member.name} £${penceToDecimal(shares.get(member.id)!)}`).join(", ")}`].filter(Boolean);
    await tx.orm.public.ActivityEvent.create({ groupId, memberId: saved.member.id, eventType: "EXPENSE_UPDATED",
      description: `${saved.member.name} updated "${review.description}" — ${changes.join("; ")}`,
      entityType: "EXPENSE", entityId: expenseId, createdAt: now });
    return { groupId, shareToken: saved.group.shareToken };
  });
}

export async function deleteSavedExpense(groupId: number, expenseId: number, version: string) {
  return db.transaction(async tx => {
    const saved = await load(groupId, expenseId, tx);
    if (!saved.expense || saved.expense.deletedAt) {
      if (saved.event?.eventType !== "EXPENSE_DELETED") throw new ExpenseError(unavailable);
      return { groupId, shareToken: saved.group.shareToken };
    }
    checkVersion(version, saved.version);
    const ledger = await getLedgerForGroup(groupId, tx);
    if (ledger.payments.some(payment => payment.status !== "REJECTED" && !payment.allocations?.length)) throw new ExpenseError("Reconcile historical payments in Payment history before deleting expenses. Without their expense associations, this deletion could remove the wrong payment effects.");
    for (const payment of ledger.payments) effectivePaymentPence(payment);
    const now = new Date().toISOString();
    // Retain the expense and its shares as audit evidence and FK targets. This
    // tombstone is the single authoritative exclusion for every linked amount.
    await tx.orm.public.Expense.where({ id: expenseId, groupId, deletedAt: null }).updateAll({ deletedAt: now });
    await tx.orm.public.ActivityEvent.create({ groupId, memberId: saved.member.id, eventType: "EXPENSE_DELETED",
      description: `${saved.member.name} deleted "${saved.expense.description}" — £${saved.expense.amount}. Linked repayment allocations are excluded because their expense was deleted; payment history is retained.`,
      entityType: "EXPENSE", entityId: expenseId, createdAt: now });
    for (const payment of ledger.payments.filter(payment => payment.allocations?.some(allocation => allocation.expenseId === expenseId))) {
      const allocation = payment.allocations!.find(allocation => allocation.expenseId === expenseId)!;
      await tx.orm.public.ActivityEvent.create({ groupId, memberId: saved.member.id, eventType: "PAYMENT_ALLOCATION_EXCLUDED", entityType: "PAYMENT", entityId: payment.id,
        description: `${saved.member.name} excluded ${allocation.amountPence} pence of payment #${payment.id} because expense "${saved.expense.description}" was deleted.`, createdAt: now });
    }
    return { groupId, shareToken: saved.group.shareToken };
  });
}
