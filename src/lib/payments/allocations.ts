import { parsePence } from "@/lib/expenses/money";
import type { PaymentRecord } from "@/lib/payments/types";

/**
 * Validate the full allocation sum, then return only non-excluded pennies.
 * Excluded rows still belong to the original payment amount and audit history.
 * Null means unreconciled history; zero means valid allocations are all excluded.
 * @throws RangeError for invalid, duplicated or mismatched allocations.
 */
export function effectivePaymentPence(payment: Pick<PaymentRecord, "amount" | "allocations">): bigint | null {
  if (!payment.allocations?.length) return null;
  const ids = new Set<number>();
  let total = BigInt(0), effective = BigInt(0);
  for (const allocation of payment.allocations) {
    if (!allocation.valid || ids.has(allocation.expenseId) || !/^[1-9]\d*$/.test(allocation.amountPence)) throw new RangeError("Invalid payment allocation.");
    ids.add(allocation.expenseId);
    const amount = BigInt(allocation.amountPence);
    total += amount;
    if (!allocation.excluded) effective += amount;
  }
  if (total !== BigInt(parsePence(payment.amount))) throw new RangeError("Payment allocations do not match the amount.");
  return effective;
}

/** Unresolved pending reports retain their reservation until owner reconciliation. */
export function pendingPaymentPence(payment: PaymentRecord): bigint {
  return payment.status === "SENT" ? effectivePaymentPence(payment) ?? BigInt(parsePence(payment.amount)) : BigInt(0);
}
