"use client";

import { useState } from "react";
import { splitTotals } from "@/lib/expenses/money";
import type { ExpenseInput, ExpenseReview as Review } from "@/lib/expenses/types";

export default function ExpenseReview({ input, review, action, pending, error, editing = false, requestKey }: {
  input: ExpenseInput; review: Review; action: (data: FormData) => void; pending: boolean; error?: string;
  editing?: boolean;
  requestKey?: string;
}) {
  const [amounts, setAmounts] = useState(() => Object.fromEntries(review.participants.map(member => [
    member.id, input.shares?.find(share => share.memberId === String(member.id))?.amount ?? member.amount,
  ])));
  const totals = splitTotals(review.amount, review.participants.map(member => amounts[member.id]));
  return (
    <form action={action} aria-label="Review expense" onSubmit={event => {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value === "save" && !totals.balanced) event.preventDefault();
    }} className="mt-8 space-y-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Review expense</p>
        <h2 className="mt-2 break-words text-2xl font-semibold">{review.description}</h2>
        <p className="mt-2 break-words text-sm text-muted">Paid by {review.payer.name}</p>
      </header>
      {error && <p role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <fieldset disabled={pending}>
        <legend className="text-lg font-semibold">Split</legend>
        <p id="share-help" className="mt-1 text-sm text-muted">Start equally, or adjust each person&apos;s share.</p>
        <ul className="mt-4 divide-y divide-slate-100">
          {review.participants.map(member => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3">
              <label htmlFor={`share-${member.id}`} className="min-w-0 break-words font-medium">{member.name}</label>
              <div className="flex w-32 shrink-0 items-center rounded-xl border border-line px-3 focus-within:ring-2 focus-within:ring-accent/20">
                <span aria-hidden="true" className="text-muted">£</span>
                <input type="hidden" name="shareMemberId" value={member.id} />
                <input id={`share-${member.id}`} name="shareAmount" type="text" inputMode="decimal" required maxLength={32}
                  pattern="(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?" aria-describedby="share-help split-status" value={amounts[member.id]}
                  onChange={event => setAmounts(current => ({ ...current, [member.id]: event.target.value }))}
                  className="w-full min-w-0 bg-transparent py-3 pl-2 text-right tabular-nums outline-none" />
              </div>
            </li>
          ))}
        </ul>
      </fieldset>
      <dl className="space-y-3 rounded-xl bg-subtle p-4 text-sm tabular-nums">
        <div className="flex justify-between gap-3"><dt>Expense total</dt><dd className="font-semibold">£{review.amount}</dd></div>
        <div className="flex justify-between gap-3"><dt>Assigned</dt><dd>£{totals.assigned}</dd></div>
        <div className="flex justify-between gap-3 border-t border-line pt-3"><dt>Remaining</dt><dd className="font-semibold">£{totals.remaining}</dd></div>
      </dl>
      <p id="split-status" role="status" className={`text-sm ${totals.balanced ? "text-accent" : "text-danger"}`}>
        {!totals.valid ? "Enter a valid, non-negative amount for every person. Totals exclude invalid entries." : totals.balanced ? "All assigned. Ready to save." : "Adjust the shares until the remaining amount is £0.00."}
      </p>
      <button type="button" disabled={pending} onClick={() => setAmounts(Object.fromEntries(review.participants.map(member => [member.id, member.amount])))}
        className="text-sm font-semibold text-accent underline underline-offset-4 disabled:opacity-50">Reset to equal split</button>
      <input type="hidden" name="description" value={input.description} />
      {!editing && <input type="hidden" name="requestKey" value={requestKey ?? ""} />}
      <input type="hidden" name="amount" value={input.amount} />
      <input type="hidden" name="paidByMemberId" value={input.paidByMemberId} />
      {input.participantIds.map(id => <input key={id} type="hidden" name="participantIds" value={id} />)}
      <input type="hidden" name="confirmed" value="yes" />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button name="intent" value="edit" formNoValidate disabled={pending} className="rounded-xl border border-line px-5 py-3 font-semibold disabled:opacity-50">Back and edit</button>
        <button name="intent" value="save" disabled={pending || !totals.balanced} className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Saving…" : "Confirm & Save"}</button>
      </div>
      <p className="text-xs text-muted">{editing ? "Existing shares are kept for selected members. New participants start at zero. Adjust the remaining amount or choose Reset to equal split. Repayments remain recorded. Nothing is saved until you confirm." : "Changing expense details starts a new equal split. Nothing is saved until you confirm."}</p>
    </form>
  );
}
