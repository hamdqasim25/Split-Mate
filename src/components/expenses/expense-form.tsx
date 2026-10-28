"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import ExpenseReview from "@/components/expenses/expense-review";
import type { ExpenseFormContext, ExpenseFormState } from "@/lib/expenses/types";

const inputClass = "mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

export default function ExpenseForm({ context, action, initialInput, editing = false, requestKey }: {
  context: ExpenseFormContext;
  initialInput?: import("@/lib/expenses/types").ExpenseInput;
  editing?: boolean;
  requestKey?: string;
  action: (previous: ExpenseFormState, form: FormData) => Promise<ExpenseFormState>;
}) {
  const [creationKey] = useState(editing ? undefined : requestKey);
  const [state, formAction, pending] = useActionState(async (previous: ExpenseFormState, form: FormData) => {
    if (editing) return action(previous, form);
    try { return await action(previous, form); }
    catch (error) {
      unstable_rethrow(error);
      // An uncertain response must leave this same creation attempt retryable.
      const field = (name: string) => String(form.get(name) ?? "");
      const shareIds = form.getAll("shareMemberId");
      const amounts = form.getAll("shareAmount");
      return { ...previous, requestKey: creationKey,
        input: { description: field("description"), amount: field("amount"), paidByMemberId: field("paidByMemberId"),
          participantIds: form.getAll("participantIds").map(String),
          ...(shareIds.length ? { shares: shareIds.map((id, index) => ({ memberId: String(id), amount: String(amounts[index] ?? "") })) } : {}) },
        error: "Unable to confirm the response. Retry here with the same details, or check the group for your saved expense." };
    }
  }, { input: initialInput, requestKey: creationKey });
  const { input, review } = state;
  if (state.savedDestination) return <div role="status" className="mt-8 space-y-4">
    <p>Your expense was saved. The group could not refresh automatically.</p>
    <Link href={state.savedDestination} className="font-semibold underline">Return to group</Link>
  </div>;
  if (review && input) return <ExpenseReview
    key={JSON.stringify([input, review, state.error])}
    input={input} review={review} action={formAction} pending={pending} error={state.error} editing={editing} requestKey={creationKey}
  />;
  return (
    <form className="mt-8 space-y-6 rounded-2xl border border-line bg-surface p-6 sm:p-8"
      aria-label="Expense details" action={formAction}>
      {!editing && <input type="hidden" name="requestKey" value={creationKey ?? ""} />}
      <p className="text-sm leading-6 text-muted">Choose who paid and who took part. You can adjust each share on the next step before saving.</p>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <fieldset disabled={pending} className="space-y-6">
      <legend className="sr-only">Expense details</legend>
      {editing && input?.shares?.map(share => <span key={share.memberId} hidden><input type="hidden" name="shareMemberId" value={share.memberId} /><input type="hidden" name="shareAmount" value={share.amount} /></span>)}
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
          {context.members.filter(member => member.payerEligible !== false).map((member) => <option key={member.id} value={member.id}>{member.name}{member.isActive === false ? " (inactive)" : ""}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Participants</legend>
        <p id="expense-participants-help" className="mt-2 text-sm text-muted">Select everyone included in this expense.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {context.members.filter(member => member.participantEligible !== false).map((member) => (
            <label key={member.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" name="participantIds" value={member.id} aria-describedby="expense-participants-help"
                defaultChecked={input?.participantIds.includes(String(member.id)) ?? false} className="h-5 w-5 shrink-0 accent-emerald-700" />
              <span className="break-words text-sm">{member.name}{member.isActive === false ? " (inactive)" : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button type="submit" name="intent" value="review" disabled={pending}
        className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        {pending ? "Calculating split…" : "Review split"}
      </button>
      </fieldset>
      <p role="status" className="text-sm text-muted">{pending ? "Calculating your split…" : ""}</p>
    </form>
  );
}
