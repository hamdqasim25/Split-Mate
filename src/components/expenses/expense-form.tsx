"use client";

import { useActionState } from "react";
import ExpenseReview from "@/components/expenses/expense-review";
import type { ExpenseFormContext, ExpenseFormState } from "@/lib/expenses/types";

const inputClass = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20";

export default function ExpenseForm({ context, action }: {
  context: ExpenseFormContext;
  action: (previous: ExpenseFormState, form: FormData) => Promise<ExpenseFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const { input, review } = state;
  if (review && input) return <ExpenseReview
    key={JSON.stringify([input, review, state.error])}
    input={input} review={review} action={formAction} pending={pending} error={state.error}
  />;
  return (
    <form className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
      aria-label="Expense details" action={formAction}>
      <p className="text-sm leading-6 text-slate-600">Choose who paid and who took part. You can adjust each share on the next step before saving.</p>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <fieldset disabled={pending} className="space-y-6">
      <legend className="sr-only">Expense details</legend>
      <div>
        <label htmlFor="expense-description" className="text-sm font-semibold">Description</label>
        <input id="expense-description" name="description" type="text" required maxLength={1000}
          defaultValue={input?.description ?? ""} placeholder="e.g. Padel court" className={inputClass} />
      </div>
      <div>
        <label htmlFor="expense-amount" className="text-sm font-semibold">Amount ({context.group.currency})</label>
        <input id="expense-amount" name="amount" type="text" inputMode="decimal" required
          defaultValue={input?.amount ?? ""} maxLength={32} placeholder="0.00" className={inputClass} />
      </div>
      <div>
        <label htmlFor="expense-payer" className="text-sm font-semibold">Paid by</label>
        <select id="expense-payer" name="paidByMemberId" required defaultValue={input?.paidByMemberId ?? String(context.currentMember.id)} className={inputClass}>
          {context.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Participants</legend>
        <p id="expense-participants-help" className="mt-2 text-sm text-slate-600">Select everyone included in this expense.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {context.members.map((member) => (
            <label key={member.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input type="checkbox" name="participantIds" value={member.id} aria-describedby="expense-participants-help"
                defaultChecked={input?.participantIds.includes(String(member.id)) ?? false} className="h-5 w-5 shrink-0 accent-emerald-700" />
              <span className="break-words text-sm">{member.name}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" name="intent" value="review" disabled={pending}
        className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Calculating split…" : "Review split"}
      </button>
      </fieldset>
      <p role="status" className="text-sm text-slate-600">{pending ? "Calculating your split…" : ""}</p>
    </form>
  );
}
