"use client";

import { useActionState } from "react";
import PaymentAllocationFields from "@/components/groups/payment-allocation-fields";
import type { PaymentHistory, PaymentExpense, PaymentActionState } from "@/lib/payments/types";
import { formatPence, parsePence } from "@/lib/expenses/money";

export default function PaymentReconciliationForm({ payment, expenses, action }: {
  payment: PaymentHistory; expenses: PaymentExpense[];
  action: (previous: PaymentActionState, form: FormData) => Promise<PaymentActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const frozen = payment.allocations?.filter(row => row.excluded) ?? [];
  const excluded = frozen.reduce((sum, row) => sum + BigInt(row.amountPence), BigInt(0));
  const initial = Object.fromEntries((payment.allocations ?? []).filter(row => !row.excluded).map(row => [row.expenseId, formatPence(BigInt(row.amountPence))]));
  return <form action={formAction} className="mt-5 space-y-4 rounded-xl border border-line bg-surface p-5">
    <p className="text-sm text-muted">Choose only the expenses this payment actually covered. Do not guess. The original payment amount and status stay unchanged. Changing associations affects which amounts will be excluded when an expense is deleted.</p>
    {frozen.map(row => <p key={row.expenseId} className="text-sm text-muted">{row.description}: £{formatPence(BigInt(row.amountPence))} permanently excluded because the expense was deleted.</p>)}
    <fieldset disabled={pending || !!state.success} className="space-y-4">
      <legend className="sr-only">Explicit payment reconciliation</legend>
      <PaymentAllocationFields expenses={expenses} amount={formatPence(BigInt(parsePence(payment.amount)) - excluded)} initial={initial} prefix={`reconcile-${payment.id}`} />
      <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="confirmed" value="yes" required className="h-5 w-5" />I have checked these expense associations.</label>
      <button className="min-h-11 rounded-xl bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50" disabled={pending || !!state.success}>{pending ? "Saving…" : "Save associations"}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-accent">{state.success} Return to the group to see refreshed balances.</p>}
  </form>;
}
