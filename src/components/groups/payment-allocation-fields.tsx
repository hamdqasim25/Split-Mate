"use client";

import { useState } from "react";
import { formatPence, parsePence } from "@/lib/expenses/money";
import type { PaymentExpense } from "@/lib/payments/types";

// Draft input can be empty or incomplete, including after a successful form
// reset. Keep the strict money parser at this boundary; never replace invalid
// submitted values with zero or show partial sums as a balanced allocation.
function draftTotals(amount: string, values: Record<number, string>) {
  let total: bigint | undefined;
  let amountError: string | undefined;
  try { total = BigInt(parsePence(amount)); }
  catch (error) {
    if (!(error instanceof RangeError)) throw error;
    amountError = amount === "" ? "Enter the payment amount to calculate the remaining allocation." : `Payment amount: ${error.message}`;
  }
  const errors: Record<number, string> = {};
  let assigned = BigInt(0);
  let count = 0;
  for (const [id, value] of Object.entries(values)) {
    if (value === "") continue; // Unused expenses are omitted from submission.
    count++;
    try { assigned += BigInt(parsePence(value)); }
    catch (error) {
      if (!(error instanceof RangeError)) throw error;
      errors[Number(id)] = error.message;
    }
  }
  const valid = Object.keys(errors).length === 0;
  return {
    errors, amountError,
    assigned: valid ? formatPence(assigned) : null,
    remaining: valid && total !== undefined ? formatPence(total - assigned) : null,
    balanced: valid && count > 0 && total !== undefined && assigned === total,
  };
}

export default function PaymentAllocationFields({ expenses, amount, initial = {}, prefix }: {
  expenses: PaymentExpense[]; amount: string; initial?: Record<number, string>; prefix: string;
}) {
  const [values, setValues] = useState<Record<number, string>>(initial);
  const choices = [...expenses.map(expense => ({ id: expense.id, description: expense.description })),
    ...Object.keys(values).map(Number).filter(id => values[id] && !expenses.some(expense => expense.id === id)).map(id => ({ id, description: "Previously selected expense (retry or clear)" }))];
  const totals = draftTotals(amount, values);
  return <fieldset className="space-y-2">
    <legend className="text-sm font-semibold">Which expenses does this payment cover?</legend>
    <p className="text-xs text-muted">Enter the amount paid against each expense. Leave other expenses blank. The allocations must equal the payment total.</p>
    {choices.length === 0 && <p className="text-sm text-warning">No matching expenses. Choose a recipient who paid an expense shared by the sender.</p>}
    {choices.map(expense => <div key={expense.id} className="space-y-1">
      <div className="flex items-center justify-between gap-3">
      <label htmlFor={`${prefix}-${expense.id}`} className="min-w-0 break-words text-sm">{expense.description} (GBP)</label>
      {values[expense.id] && <input type="hidden" name="allocationExpenseId" value={expense.id} />}
      <input id={`${prefix}-${expense.id}`} name={values[expense.id] ? "allocationAmount" : undefined} inputMode="decimal" maxLength={32} value={values[expense.id] ?? ""}
        aria-invalid={!!totals.errors[expense.id]} aria-describedby={totals.errors[expense.id] ? `${prefix}-${expense.id}-error` : undefined}
        onChange={event => setValues(current => ({ ...current, [expense.id]: event.target.value }))}
        className="min-h-11 w-28 shrink-0 rounded-lg border border-line bg-surface p-2 text-right tabular-nums" />
      </div>
      {totals.errors[expense.id] && <p id={`${prefix}-${expense.id}-error`} className="text-sm text-danger">{totals.errors[expense.id]}</p>}
    </div>)}
    <p role="status" className={`text-sm tabular-nums ${totals.balanced ? "text-accent" : "text-warning"}`}>
      Assigned {totals.assigned === null ? "unavailable" : `£${totals.assigned}`} · Remaining {totals.remaining === null ? "unavailable" : `£${totals.remaining}`}
      {totals.amountError ? ` — ${totals.amountError}` : totals.assigned === null ? " — check the allocation amounts" : !totals.balanced ? " — allocations must equal the payment amount" : ""}
    </p>
  </fieldset>;
}
