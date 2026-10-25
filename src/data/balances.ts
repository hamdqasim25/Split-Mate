import "server-only";

import { db } from "@/prisma/db";
import { createHash } from "node:crypto";
import { effectivePaymentPence } from "@/lib/payments/allocations";
import { formatPence, parsePence } from "@/lib/expenses/money";
import type { PaymentHistory, PaymentRecord, PaymentExpense } from "@/lib/payments/types";

type Member = { id: number; name: string; isActive: boolean };
type Expense = { id: number; amount: string; paidByMemberId: number };
type Share = { expenseId: number; memberId: number; amountOwed: string };

export type GroupBalances =
  | { status: "unavailable" }
  | {
      status: "ready";
      expenseCount: number;
      totalPaid: string;
      totalShare: string;
      members: (Member & { paid: string; share: string; sent: string; received: string; net: string })[];
    };

class InvalidLedger extends Error {}

/** Pure calculation. Preserve supplied member order; never repair financial data. */
export function calculateBalances(members: Member[], expenses: Expense[], shares: Share[], payments: PaymentRecord[] = []): GroupBalances {
  try {
    const totals = new Map(members.map(member => [member.id, { paid: BigInt(0), share: BigInt(0), sent: BigInt(0), received: BigInt(0), used: false }]));
    const ledger = new Map<number, { amount: bigint; allocated: bigint; members: Set<number> }>();
    if (totals.size !== members.length) throw new InvalidLedger();
    for (const expense of expenses) {
      const payer = totals.get(expense.paidByMemberId);
      if (!payer || ledger.has(expense.id)) throw new InvalidLedger();
      const amount = BigInt(parsePence(expense.amount));
      payer.paid += amount;
      payer.used = true;
      ledger.set(expense.id, { amount, allocated: BigInt(0), members: new Set() });
    }
    for (const share of shares) {
      const expense = ledger.get(share.expenseId);
      const member = totals.get(share.memberId);
      if (!expense || !member || expense.members.has(share.memberId)) throw new InvalidLedger();
      const amount = BigInt(parsePence(share.amountOwed, true));
      expense.members.add(share.memberId);
      expense.allocated += amount;
      member.share += amount;
      member.used = true;
    }
    for (const expense of ledger.values()) {
      if (expense.members.size === 0 || expense.amount !== expense.allocated) throw new InvalidLedger();
    }
    const paymentIds = new Set<number>();
    for (const payment of payments) {
      const sender = totals.get(payment.payerMemberId);
      const receiver = totals.get(payment.receiverMemberId);
      if (!sender || !receiver || sender === receiver || paymentIds.has(payment.id)
        || !["SENT", "CONFIRMED", "REJECTED"].includes(payment.status)) throw new InvalidLedger();
      paymentIds.add(payment.id);
      parsePence(payment.amount);
      const effective = effectivePaymentPence(payment);
      sender.used = receiver.used = true;
      if (payment.status === "CONFIRMED") {
        if (effective === null) throw new InvalidLedger();
        sender.sent += effective;
        receiver.received += effective;
      }
    }
    let paid = BigInt(0);
    let share = BigInt(0);
    const rows = members.flatMap(member => {
      const total = totals.get(member.id)!;
      paid += total.paid;
      share += total.share;
      return member.isActive || total.used ? [{
        ...member, paid: formatPence(total.paid), share: formatPence(total.share),
        sent: formatPence(total.sent), received: formatPence(total.received),
        net: formatPence(total.paid - total.share + total.sent - total.received),
      }] : [];
    });
    if (paid !== share) throw new InvalidLedger();
    return { status: "ready", expenseCount: expenses.length, totalPaid: formatPence(paid), totalShare: formatPence(share), members: rows };
  } catch (error) {
    if (error instanceof InvalidLedger || error instanceof RangeError) return { status: "unavailable" };
    throw error;
  }
}

type Ledger = { balances: GroupBalances; payments: PaymentHistory[]; paymentExpenses: PaymentExpense[] };
/** Internal: authorize first. If supplied, client MUST be an open transaction.
 * All expense/payment writers take this same group lock before financial reads.
 * Guarded updateAll retains its WHERE in SQL in the pinned Prisma RC.
 */
export async function getLedgerForGroup(groupId: number, client?: Pick<typeof db, "orm">): Promise<Ledger> {
  if (!client) return db.transaction(tx => getLedgerForGroup(groupId, tx));
  const [group] = await client.orm.public.Group.where({ id: groupId, currency: "GBP" })
    .select("id").updateAll({ currency: "GBP" });
  if (!group) return { balances: { status: "unavailable" }, payments: [], paymentExpenses: [] };
  // Read the complete ledger while holding the group lock, including mutable
  // payment statuses. No writer using the protocol can change it until commit.
  const expenses = await client.orm.public.Expense.where({ groupId })
    .select("id", "amount", "paidByMemberId", "description", "deletedAt").all();
  const members = await client.orm.public.GroupMember.where({ groupId })
    .select("id", "name", "isActive")
    .orderBy([(member) => member.addedAt.asc(), (member) => member.id.asc()]).all();
  const shares: Share[] = [];
  // Bound SQL parameters, not the number of ledger records or group members.
  for (let offset = 0; offset < expenses.length; offset += 500) {
    const ids = expenses.slice(offset, offset + 500).map(expense => expense.id);
    shares.push(...await client.orm.public.ExpenseParticipant.where(row => row.expenseId.in(ids))
      .select("expenseId", "memberId", "amountOwed").all());
  }
  const payments = await client.orm.public.Payment.where({ groupId })
    .select("id", "payerMemberId", "receiverMemberId", "amount", "status", "createdAt", "sentAt", "confirmedAt")
    .orderBy([row => row.createdAt.desc(), row => row.id.desc()]).all();
  const names = new Map(members.map(member => [member.id, member.name]));
  const allocations: { paymentId: number; expenseId: number; amountPence: bigint }[] = [];
  for (let offset = 0; offset < payments.length; offset += 500) {
    allocations.push(...await client.orm.public.PaymentAllocation.where(row => row.paymentId.in(payments.slice(offset, offset + 500).map(payment => payment.id))).all());
  }
  const reconciliationEvents = payments.length ? await client.orm.public.ActivityEvent.where({ groupId, eventType: "PAYMENT_RECONCILED" }).select("id", "entityId").all() : [];
  const revisions = new Map<number, number>();
  for (const event of reconciliationEvents) if (event.entityId !== null) revisions.set(event.entityId, Math.max(event.id, revisions.get(event.entityId) ?? 0));
  const history: PaymentHistory[] = payments.map(payment => {
    const allocated = allocations.filter(row => row.paymentId === payment.id).sort((a, b) => a.expenseId - b.expenseId).map(row => {
      const expense = expenses.find(expense => expense.id === row.expenseId);
      return { expenseId: row.expenseId, description: expense?.description ?? "Unavailable expense", amountPence: String(row.amountPence),
        excluded: !!expense?.deletedAt,
        valid: !!expense && (payment.status === "REJECTED" || (expense.paidByMemberId === payment.receiverMemberId && shares.some(share => share.expenseId === expense.id && share.memberId === payment.payerMemberId))),
      };
    });
    return { ...payment, allocations: allocated,
      allocationVersion: createHash("sha256").update(JSON.stringify([payment.id, payment.status, allocated, revisions.get(payment.id) ?? 0])).digest("hex"),
      payerName: names.get(payment.payerMemberId) ?? "Unavailable member", receiverName: names.get(payment.receiverMemberId) ?? "Unavailable member" };
  });
  const active = expenses.filter(expense => !expense.deletedAt);
  const activeIds = new Set(active.map(expense => expense.id));
  return {
    balances: calculateBalances(members, active, shares.filter(share => activeIds.has(share.expenseId)), history),
    payments: history,
    paymentExpenses: active.map(expense => ({ id: expense.id, description: expense.description, paidByMemberId: expense.paidByMemberId,
      shares: shares.filter(share => share.expenseId === expense.id).map(share => ({ memberId: share.memberId, amount: share.amountOwed })) })),
  };
}

/** Internal authorized-group helper; a supplied client must be transactional. */
export async function getBalancesForGroup(groupId: number, client?: Pick<typeof db, "orm">): Promise<GroupBalances> {
  return (await getLedgerForGroup(groupId, client)).balances;
}
