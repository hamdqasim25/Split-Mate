import "server-only";
import type { GroupBalances } from "@/data/balances";
import type { PaymentRecord } from "@/lib/payments/types";
import { formatPence, MAX_PENCE } from "@/lib/expenses/money";
import { effectivePaymentPence, pendingPaymentPence } from "@/lib/payments/allocations";

/** Shared by authoritative validation and server-rendered options. Canonical
 * ledger decimals are exact, signed aggregates, not rounded display amounts. */
export function paymentCapacity(senderNet: string, receiverNet: string, payments: PaymentRecord[], senderId: number, receiverId: number, excludeId?: number) {
  const debt = -BigInt(senderNet.replace(".", ""));
  const credit = BigInt(receiverNet.replace(".", ""));
  let outgoing = BigInt(0), incoming = BigInt(0);
  for (const payment of payments) {
    if (payment.status !== "SENT" || payment.id === excludeId) continue;
    if (payment.payerMemberId === senderId) outgoing += pendingPaymentPence(payment);
    if (payment.receiverMemberId === receiverId) incoming += pendingPaymentPence(payment);
  }
  return { debt, credit, availableDebt: debt - outgoing, availableCredit: credit - incoming };
}

export function paymentOptions(balances: GroupBalances, payments: PaymentRecord[], senderId: number, excludeId?: number) {
  if (balances.status !== "ready") return [];
  const sender = balances.members.find(member => member.id === senderId && member.isActive);
  if (!sender) return [];
  return balances.members.flatMap(receiver => {
    if (!receiver.isActive || receiver.id === senderId) return [];
    const capacity = paymentCapacity(sender.net, receiver.net, payments, senderId, receiver.id, excludeId);
    const max = [capacity.availableDebt, capacity.availableCredit, BigInt(MAX_PENCE)].reduce((a, b) => a < b ? a : b);
    return max > BigInt(0) && capacity.debt > BigInt(0) && capacity.credit > BigInt(0)
      ? [{ id: receiver.id, name: receiver.name, maximum: formatPence(max) }] : [];
  });
}

export function canConfirmPayment(balances: GroupBalances, payments: PaymentRecord[], payment: PaymentRecord) {
  const effective = effectivePaymentPence(payment);
  if (effective === null || effective <= BigInt(0)) return false;
  const option = paymentOptions(balances, payments, payment.payerMemberId, payment.id).find(row => row.id === payment.receiverMemberId);
  return !!option && effective <= BigInt(option.maximum.replace(".", ""));
}
