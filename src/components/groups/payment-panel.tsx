"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PaymentAllocationFields from "@/components/groups/payment-allocation-fields";
import { effectivePaymentPence } from "@/lib/payments/allocations";
import { formatPence } from "@/lib/expenses/money";
import { guestPaymentAction, ownerPaymentAction, reviewPaymentAction } from "@/app/actions/payments";
import { paymentStatusLabel } from "@/lib/payments/types";
import type { PaymentAccess, PaymentActionState, PaymentHistory, PaymentExpense } from "@/lib/payments/types";

type Recipient = { id: number; name: string; maximum: string };
const control = "mt-1 w-full rounded-lg border border-line bg-surface p-3";
const button = "rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 min-w-11 touch-manipulation rounded-lg border border-line bg-surface px-2 py-1 text-sm font-medium text-accent hover:bg-subtle disabled:opacity-50";
function Result({ state }: { state: PaymentActionState }) {
  return <>{state.error && <p role="alert" className="col-span-full my-2 text-sm text-danger">{state.error}</p>}{state.success && <p role="status" className="col-span-full my-2 text-sm text-accent">{state.success}</p>}</>;
}
function focusCard(element: HTMLElement | null) {
  element?.closest("li")?.querySelector<HTMLElement>("h3")?.focus();
}

export function PaymentForm({ access, recipients, senderId, requestKey, expenses = [] }: {
  access: PaymentAccess; recipients: Recipient[]; senderId: number; requestKey: string; expenses?: PaymentExpense[];
}) {
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const recipientControl = useRef<HTMLSelectElement>(null);
  const submitting = useRef(false);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(requestKey);
  const only = recipients.length === 1 ? recipients[0] : undefined;
  const [values, setValues] = useState({ receiverMemberId: only ? String(only.id) : "", amount: only?.maximum ?? "" });
  const [state, action, pending] = useActionState(async (previous: PaymentActionState, form: FormData) => {
    if (submitting.current) return previous;
    submitting.current = true;
    try {
      const result = access.kind === "owner" ? await ownerPaymentAction(access.groupId, previous, form) : await guestPaymentAction(access.shareToken, previous, form);
      if (result.success) {
        setKey(crypto.randomUUID());
        setValues({ receiverMemberId: "", amount: "" });
        setOpen(false);
        focusCard(trigger.current);
        router.refresh();
      }
      return result;
    } catch {
      return { error: "Connection lost. Retry this same form; do not create a second report." };
    } finally { submitting.current = false; }
  }, {});
  const owner = access.kind === "owner";
  const prefix = "payment-" + senderId;
  // Stay mounted on the card after refresh so successful feedback and uncertain
  // retries retain their state even if reservations exhaust current eligibility.
  if (!recipients.length && !open) return <Result state={state} />;
  return <div className="contents">
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={prefix} className={`${secondary} balance-payment-trigger justify-self-start`} disabled={pending}
      onClick={() => {
        if (!values.receiverMemberId && only) setValues({ receiverMemberId: String(only.id), amount: only.maximum });
        setOpen(true);
        requestAnimationFrame(() => recipientControl.current?.focus());
      }}>
      {owner ? "Record payment" : "I've paid"}
    </button>
    <form id={prefix} hidden={!open} action={action} className="col-span-full my-2 min-w-0 rounded-lg border border-line bg-subtle p-3">
      <p className="text-sm text-muted">{owner ? "Record an external payment already completed. If a matching report is pending, confirm it below instead." : "Report money paid outside SPLITMate. The owner must confirm it before your balance changes."}</p>
      <input type="hidden" name="requestKey" value={key} />
      {owner && <input type="hidden" name="payerMemberId" value={senderId} />}
      <fieldset disabled={pending} className="mt-4 space-y-3">
        <legend className="sr-only">Payment details in pounds</legend>
        <div><label htmlFor={prefix + "-receiver"}>Recipient</label><select ref={recipientControl} id={prefix + "-receiver"} name="receiverMemberId" required className={control} value={values.receiverMemberId}
          onChange={e => { const selected = recipients.find(member => String(member.id) === e.target.value); setValues({ receiverMemberId: e.target.value, amount: selected?.maximum ?? "" }); }}>
          <option value="">Choose recipient</option>{recipients.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          {values.receiverMemberId && !recipients.some(member => String(member.id) === values.receiverMemberId) && <option value={values.receiverMemberId}>Previously selected recipient (retry)</option>}
        </select></div>
        <div><label htmlFor={prefix + "-amount"}>Amount paid (GBP)</label><input id={prefix + "-amount"} name="amount" required inputMode="decimal" maxLength={32} className={control} value={values.amount} onChange={e => setValues({ ...values, amount: e.target.value })} /></div>
        <PaymentAllocationFields key={key} prefix={prefix + "-allocation"} amount={values.amount} expenses={expenses.filter(expense => expense.paidByMemberId === Number(values.receiverMemberId) && expense.shares.some(share => share.memberId === senderId))} />
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={button}>{pending ? "Saving..." : owner ? "Record confirmed payment" : "Report payment"}</button>
          <button type="button" className="rounded-lg border border-line px-4 py-3" onClick={() => { setOpen(false); trigger.current?.focus(); }}>Cancel</button>
        </div>
      </fieldset>
    </form>
    <Result state={state} />
  </div>;
}

export function PaymentReview({ groupId, payment, currentMemberId, canConfirm = true }: { groupId: number; payment: PaymentHistory; currentMemberId: number; canConfirm?: boolean }) {
  const router = useRouter();
  const element = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const [state, action, pending] = useActionState(async (previous: PaymentActionState, form: FormData) => {
    if (submitting.current) return previous;
    submitting.current = true;
    try {
      const result = await reviewPaymentAction(groupId, payment.id, previous, form);
      if (result.success) { focusCard(element.current); router.refresh(); }
      return result;
    } catch { return { error: "Connection lost. Retry; confirmation cannot apply the payment twice." }; }
    finally { submitting.current = false; }
  }, {});
  const receipt = payment.receiverMemberId === currentMemberId;
  return <form ref={element} action={action} className="mt-3">
    <input type="hidden" name="allocationVersion" value={payment.allocationVersion ?? ""} />
    <PaymentAllocations payment={payment} />
    <p className="mb-3 text-sm text-muted">{!canConfirm ? "This report cannot be confirmed against current balances or active members. Check the group; reject an incorrect report." : receipt ? "Confirm only after you have received this money." : "Verify with the recipient that they received this money before confirming."}</p>
    <fieldset disabled={pending} className="flex flex-wrap gap-3"><legend className="sr-only">Review this payment</legend>
      {canConfirm && <button name="decision" value="confirm" className={button}>{pending ? "Saving..." : receipt ? "Confirm receipt" : "Confirm payment"}</button>}
      <button name="decision" value="reject" className="rounded-lg border border-line px-4 py-3 disabled:opacity-50">Reject</button>
    </fieldset>
    <Result state={state} />
  </form>;
}

function paymentEffect(payment: PaymentHistory) { try { return effectivePaymentPence(payment); } catch { return null; } }

function PaymentAllocations({ payment }: { payment: PaymentHistory }) {
  const effective = paymentEffect(payment);
  return <div className="mt-2 text-sm">
    {effective === null ? <p className="text-warning">Expense associations need owner reconciliation. Confirmed balances may be unavailable until resolved.</p> : <>
      <p className="tabular-nums">{effective === BigInt(0) ? "No amount remains to confirm or apply." : `${payment.status === "SENT" ? "Remaining for confirmation" : "Non-excluded amount"}: £${formatPence(effective)}`}</p>
      <ul className="mt-1 space-y-1">{payment.allocations!.map(allocation => <li key={allocation.expenseId} className="break-words text-xs text-muted">{allocation.description} — £{formatPence(BigInt(allocation.amountPence))}{allocation.excluded ? " — excluded because the expense was deleted" : ""}</li>)}</ul>
    </>}
  </div>;
}

export default function PaymentHistoryList({ payments, ownerGroupId, currentMemberId }: { payments: PaymentHistory[]; ownerGroupId?: number; currentMemberId?: number }) {
  return <section aria-labelledby="payments-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
    <h2 id="payments-heading" className="text-xl font-semibold">Payment history</h2>
    <p className="mt-2 text-sm text-muted">External payments recorded by your group. SPLITMate does not transfer money.</p>
    {payments.length === 0 ? <p className="mt-3 text-sm text-muted">No repayments recorded yet.</p> : <ul className="mt-3 space-y-4">
      {payments.map(payment => <li key={payment.id} className="rounded-xl border border-line p-4">
        <p className="break-words font-semibold">{payment.payerName} to {payment.receiverName} &mdash; &pound;{payment.amount}</p>
        <p className="mt-1 text-sm font-semibold">{paymentEffect(payment) === BigInt(0) ? "Excluded — expense deleted" : paymentStatusLabel(payment.status)}</p>
        <PaymentAllocations payment={payment} />
        {ownerGroupId && paymentEffect(payment) !== BigInt(0) && <Link href={`/groups/${ownerGroupId}/payments/${payment.id}/reconcile`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent">{payment.allocations?.length ? "Review expense associations" : "Reconcile expense associations"}</Link>}
        {ownerGroupId && currentMemberId && payment.status === "SENT" && (paymentEffect(payment) === null || paymentEffect(payment) === BigInt(0)) && <PaymentReview groupId={ownerGroupId} currentMemberId={currentMemberId} payment={payment} canConfirm={false} />}
        <p className="mt-1 break-words text-xs text-muted">Recorded <time dateTime={payment.createdAt}>{payment.createdAt.replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC")}</time></p>
        {payment.sentAt && <p className="mt-1 break-words text-xs text-muted">Sent <time dateTime={payment.sentAt}>{payment.sentAt.replace("T", " ").replace("Z", " UTC")}</time></p>}
        {payment.confirmedAt && <p className="mt-1 break-words text-xs text-muted">Confirmed <time dateTime={payment.confirmedAt}>{payment.confirmedAt.replace("T", " ").replace("Z", " UTC")}</time></p>}
        {payment.status === "SENT" && paymentEffect(payment) !== BigInt(0) && <p className="mt-2 text-sm text-muted">Non-excluded amounts are not yet applied to balances.</p>}
      </li>)}
    </ul>}
  </section>;
}
