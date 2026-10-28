import "server-only";

import { db } from "@/prisma/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getGuestSessionForGroup } from "@/lib/auth/guest-session";
import { isValidToken } from "@/lib/auth/tokens";
import { equalSplit, parsePence, penceToDecimal } from "@/lib/expenses/money";
import type { ExpenseAccess, ExpenseFormContext, ExpenseInput, ExpenseReview } from "@/lib/expenses/types";

type Client = Pick<typeof db, "orm">;
export class ExpenseError extends Error {}

// Owner session lookup uses the application's pool. Resolve it before opening
// a transaction so concurrent lock waiters cannot exhaust the pool while the
// lock holder waits for a second connection. Guest lookup uses tx directly.
async function ownerForAccess(access: ExpenseAccess) {
  if (access?.kind !== "owner" || !Number.isInteger(access.groupId) || access.groupId <= 0 || access.groupId > 2_147_483_647) return null;
  return getCurrentUser();
}

/** Route-selected authentication mode; a form member ID is never identity. */
async function resolveExpenseAccess(access: ExpenseAccess, client: Client, owner: Awaited<ReturnType<typeof ownerForAccess>>) {
  if (!access || (access.kind !== "owner" && access.kind !== "guest")) return null;
  if (access.kind === "owner") {
    if (!Number.isInteger(access.groupId) || access.groupId <= 0 || access.groupId > 2_147_483_647) return null;
    if (!owner) return null;
    const group = await client.orm.public.Group.select("id", "name", "currency")
      .first({ id: access.groupId, createdBy: owner.id });
    if (!group) return null;
    const member = await client.orm.public.GroupMember.select("id", "name")
      .first({ groupId: group.id, userId: owner.id, role: "OWNER", isActive: true });
    return member ? { group, member } : null;
  }
  if (!isValidToken(access.shareToken)) return null;
  const group = await client.orm.public.Group.select("id", "name", "currency").first({ shareToken: access.shareToken });
  if (!group) return null;
  const guest = await getGuestSessionForGroup(group.id, client);
  return guest ? { group, member: { id: guest.member.id, name: guest.member.name } } : null;
}

export async function getExpenseFormContext(access: ExpenseAccess): Promise<ExpenseFormContext | null> {
  const owner = await ownerForAccess(access);
  return db.transaction(async (tx) => {
    const resolved = await resolveExpenseAccess(access, tx, owner);
    if (!resolved) return null;
    const { group, member } = resolved;
    const members = await tx.orm.public.GroupMember.where({ groupId: group.id, isActive: true })
      .select("id", "name").orderBy([(row) => row.addedAt.asc(), (row) => row.id.asc()]).all();
    if (!members.some(candidate => candidate.id === member.id)) return null;
    return { group: { name: group.name, currency: group.currency }, currentMember: member, members };
  });
}

function memberId(value: unknown): number {
  if (typeof value !== "string" || !/^[1-9]\d{0,9}$/.test(value) || Number(value) > 2_147_483_647) {
    throw new ExpenseError("Choose valid group members.");
  }
  return Number(value);
}

export function validateExpenseInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ExpenseError("Enter expense details.");
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !["description", "amount", "paidByMemberId", "participantIds", "shares"].includes(key))) {
    throw new ExpenseError("The expense contains unsupported fields.");
  }
  if (typeof values.description !== "string" || !values.description.trim() || values.description.trim().length > 1000) {
    throw new ExpenseError("Enter a description between 1 and 1000 characters.");
  }
  let totalPence: number;
  try { totalPence = parsePence(values.amount); }
  catch (error) { if (error instanceof RangeError) throw new ExpenseError(error.message); throw error; }
  const payerId = memberId(values.paidByMemberId);
  if (!Array.isArray(values.participantIds) || values.participantIds.length === 0 || values.participantIds.length > 51) {
    throw new ExpenseError("Choose between 1 and 51 participants.");
  }
  const ids = values.participantIds.map(memberId);
  if (new Set(ids).size !== ids.length) throw new ExpenseError("Choose each participant only once.");
  let shares: Map<number, number> | undefined;
  if (values.shares !== undefined) {
    if (!Array.isArray(values.shares) || values.shares.length !== ids.length) throw new ExpenseError("Enter exactly one share for each participant.");
    shares = new Map();
    for (const share of values.shares) {
      if (!share || typeof share !== "object" || Array.isArray(share) || Object.keys(share).some(key => !["memberId", "amount"].includes(key))) throw new ExpenseError("Enter valid participant shares.");
      const id = memberId(share.memberId);
      if (!ids.includes(id) || shares.has(id)) throw new ExpenseError("Shares must match the selected participants exactly, without duplicates.");
      try { shares.set(id, parsePence(share.amount, true)); }
      catch (error) { if (error instanceof RangeError) throw new ExpenseError(error.message); throw error; }
    }
    const assigned = [...shares.values()].reduce((sum, amount) => sum + BigInt(amount), BigInt(0));
    if (assigned !== BigInt(totalPence)) throw new ExpenseError("Participant shares must add up to the expense total exactly.");
  }
  const inputValues: ExpenseInput = {
    description: values.description.trim(), amount: penceToDecimal(totalPence),
    paidByMemberId: String(payerId), participantIds: ids.map(String),
    ...(shares ? { shares: [...shares].map(([id, amount]) => ({ memberId: String(id), amount: penceToDecimal(amount) })) } : {}),
  };
  return { input: inputValues, totalPence, payerId, ids, shares };
}

/** Save revalidates identities and exact amounts; custom shares are never replaced. */
async function prepareExpense(access: ExpenseAccess, input: unknown, tx: Client, lock: boolean, owner: Awaited<ReturnType<typeof ownerForAccess>>) {
  const details = validateExpenseInput(input);
  const resolved = await resolveExpenseAccess(access, tx, owner);
  if (!resolved) throw new ExpenseError("Your access to this group is unavailable. Reopen the group and try again.");
  if (resolved.group.currency !== "GBP") throw new ExpenseError("Expense creation currently supports GBP groups only.");
  if (lock) {
    // createExpense already holds the group lock and has revalidated access.
    const requiredIds = [...new Set([resolved.member.id, details.payerId, ...details.ids])].sort((a, b) => a - b);
    // Keep selected members active and in-group until commit. Consistent lock
    // order avoids competing expense writes acquiring locks in opposite orders.
    for (const id of requiredIds) {
      const [member] = await tx.orm.public.GroupMember.where({ id, groupId: resolved.group.id, isActive: true })
        .select("id").updateAll({ isActive: true });
      if (!member) throw new ExpenseError("The payer and participants must be active members of this group.");
    }
  }
  const members = await tx.orm.public.GroupMember.where({ groupId: resolved.group.id, isActive: true })
    .select("id", "name").orderBy([(row) => row.addedAt.asc(), (row) => row.id.asc()]).all();
  const byId = new Map(members.map(member => [member.id, member]));
  const payer = byId.get(details.payerId);
  if (!payer || !byId.has(resolved.member.id) || details.ids.some(id => !byId.has(id))) {
    throw new ExpenseError("The payer and participants must be active members of this group.");
  }
  const equal = new Map(equalSplit(details.totalPence, details.ids).map(share => [share.memberId, share.pence]));
  const amounts = details.shares ?? equal;
  const ordered = members.filter(member => amounts.has(member.id));
  details.input.participantIds = ordered.map(member => String(member.id));
  const splitMethod = ordered.every(member => amounts.get(member.id) === equal.get(member.id)) ? "EQUAL" : "CUSTOM";
  const review: ExpenseReview = {
    description: details.input.description, amount: details.input.amount, payer,
    participants: ordered.map(member => ({
      id: member.id, name: member.name, amount: penceToDecimal(amounts.get(member.id)!),
    })),
  };
  return { ...resolved, input: details.input, review, splitMethod };
}

export async function previewExpense(access: ExpenseAccess, input: unknown) {
  const owner = await ownerForAccess(access);
  return db.transaction(async (tx) => {
    const prepared = await prepareExpense(access, input, tx, false, owner);
    return { input: prepared.input, review: prepared.review };
  });
}

export async function createExpense(access: ExpenseAccess, input: unknown, requestKey: unknown) {
  validateExpenseRequestKey(requestKey);
  const details = validateExpenseInput(input);
  return db.transaction(async (tx) => {
    // Resolve the session on this connection, then revalidate after the group lock.
    let owner = access?.kind === "owner" ? await getCurrentUser(tx) : null;
    const initial = await resolveExpenseAccess(access, tx, owner);
    if (!initial) throw new ExpenseError("Your access to this group is unavailable. Reopen the group and try again.");
    const [locked] = await tx.orm.public.Group.where({ id: initial.group.id, currency: "GBP" }).select("id").updateAll({ currency: "GBP" });
    if (!locked) throw new ExpenseError("Expense creation currently supports GBP groups only.");
    owner = access.kind === "owner" ? await getCurrentUser(tx) : null;
    const resolved = await resolveExpenseAccess(access, tx, owner);
    if (!resolved || resolved.group.id !== initial.group.id) throw new ExpenseError("Your access to this group is unavailable. Reopen the group and try again.");
    const amounts = details.shares ?? new Map(equalSplit(details.totalPence, details.ids).map(share => [share.memberId, share.pence]));
    // Creation-only immutable snapshot: never compare against mutable saved fields.
    const creationDetails = JSON.stringify({ version: 1, groupId: resolved.group.id, actorId: resolved.member.id,
      description: details.input.description, amountPence: details.totalPence, payerId: details.payerId,
      shares: [...amounts].sort(([a], [b]) => a - b) });
    const previous = await tx.orm.public.Expense.select("id", "groupId", "creationDetails").first({ requestKey });
    if (previous) {
      if (previous.groupId !== resolved.group.id || previous.creationDetails !== creationDetails) {
        throw new ExpenseError("This request was already used for different expense details. Return to the group to start another expense.");
      }
      return { id: previous.id, groupId: previous.groupId };
    }
    const { group, member, review, splitMethod } = await prepareExpense(access, input, tx, true, owner);
    const createdAt = new Date().toISOString();
    const expense = await tx.orm.public.Expense.select("id").create({
      groupId: group.id, description: review.description, amount: review.amount,
      paidByMemberId: review.payer.id, splitMethod, createdAt, requestKey, creationDetails,
    });
    for (const participant of review.participants) {
      await tx.orm.public.ExpenseParticipant.create({
        expenseId: expense.id, memberId: participant.id, amountOwed: participant.amount, createdAt,
      });
    }
    await tx.orm.public.ActivityEvent.create({
      groupId: group.id, memberId: member.id, eventType: "EXPENSE_CREATED",
      description: `${member.name} added "${review.description}" — £${review.amount}`,
      entityType: "EXPENSE", entityId: expense.id, createdAt,
    });
    return { id: expense.id, groupId: group.id };
  });
}

export function validateExpenseRequestKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
    throw new ExpenseError("The expense request is missing or invalid. Return to the group and open a new expense form.");
  }
}
