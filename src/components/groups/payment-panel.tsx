"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { guestPaymentAction, ownerPaymentAction, reviewPaymentAction } from "@/app/actions/payments";
import { paymentStatusLabel } from "@/lib/payments/types";
import type { PaymentAccess, PaymentActionState, PaymentHistory } from "@/lib/payments/types";

type Member = { id: number; name: string };
const control = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3";
const button = "rounded-lg bg-emerald-800 px-4 py-3 font-semibold text-white disabled:opacity-50";
function Result({ state }: { state: PaymentActionState }) {
  return <>{state.error && <p role="alert" className="mt-3 text-sm text-red-800">{state.error}</p>}{state.success && <p role="status" className="mt-3 text-sm text-emerald-800">{state.success}</p>}</>;
}

export function PaymentForm({ access, members, currentMemberId, requestKey }: {
  access: PaymentAccess; members: Member[]; currentMemberId: number; requestKey: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(requestKey);
  const [values, setValues] = useState({ payerMemberId: "", receiverMemberId: "", amount: "" });
  const [state, action, pending] = useActionState(async (previous: PaymentActionState, form: FormData) => {
    try {
      const result = access.kind === "owner" ? await ownerPaymentAction(access.groupId, previous, form) : await guestPaymentAction(access.shareToken, previous, form);
      if (result.success) {
        setKey(crypto.randomUUID());
        setValues({ payerMemberId: "", receiverMemberId: "", amount: "" });
        router.refresh();
      }
      return result;
    } catch {
      // Keep both the key and values after a lost response, including remount-free retries.
      return { error: "Connection lost. Retry this same form; do not create a second report." };
    }
  }, {});
  const owner = access.kind === "owner";
  const prefix = owner ? "owner-payment" : "guest-payment";
  return <form action={action} className="mt-5 border-t border-slate-200 pt-4">
    <h3 className="font-semibold">{owner ? "Record a completed payment" : "I've paid"}</h3>
    <p className="mt-2 text-sm text-slate-600">{owner ? "Record an external payment that has already happened. Verify it with the recipient first. If a matching report is pending, confirm that report below instead." : "Report money you have already paid outside SPLITMate. The owner must confirm it before your balance changes."}</p>
    <input type="hidden" name="requestKey" value={key} />
    <fieldset disabled={pending} className="mt-4 space-y-3">
      <legend className="sr-only">Payment details in pounds</legend>
      {owner && <div><label htmlFor={`${prefix}-payer`}>From</label><select id={`${prefix}-payer`} name="payerMemberId" required className={control} value={values.payerMemberId} onChange={e => setValues({ ...values, payerMemberId: e.target.value })}>
        <option value="">Choose sender</option>{members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select></div>}
      <div><label htmlFor={`${prefix}-receiver`}>To</label><select id={`${prefix}-receiver`} name="receiverMemberId" required className={control} value={values.receiverMemberId} onChange={e => setValues({ ...values, receiverMemberId: e.target.value })}>
        <option value="">Choose recipient</option>{members.filter(member => owner || member.id !== currentMemberId).map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select></div>
      <div><label htmlFor={`${prefix}-amount`}>Amount paid (£)</label><input id={`${prefix}-amount`} name="amount" required inputMode="decimal" maxLength={32} className={control} value={values.amount} onChange={e => setValues({ ...values, amount: e.target.value })} /></div>
      <button type="submit" className={button}>{pending ? "Saving…" : owner ? "Record confirmed payment" : "Report payment"}</button>
    </fieldset>
    <Result state={state} />
  </form>;
}

export function PaymentReview({ groupId, payment, currentMemberId }: { groupId: number; payment: PaymentHistory; currentMemberId: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (previous: PaymentActionState, form: FormData) => {
    try {
      const result = await reviewPaymentAction(groupId, payment.id, previous, form);
      if (result.success) router.refresh();
      return result;
    } catch { return { error: "Connection lost. Retry; confirmation cannot apply the payment twice." }; }
  }, {});
  const receipt = payment.receiverMemberId === currentMemberId;
  return <form action={action} className="mt-3">
    <p className="mb-3 text-sm text-slate-600">{receipt ? "Confirm only after you have received this money." : "Verify with the recipient that they received this money before confirming."}</p>
    <fieldset disabled={pending} className="flex flex-wrap gap-3"><legend className="sr-only">Review this payment</legend>
      <button name="decision" value="confirm" className={button}>{pending ? "Saving…" : receipt ? "Confirm receipt" : "Confirm payment"}</button>
      <button name="decision" value="reject" className="rounded-lg border border-slate-300 px-4 py-3 disabled:opacity-50">Reject report</button>
    </fieldset>
    <Result state={state} />
  </form>;
}

export default function PaymentPanel({ access, members, currentMemberId, payments, requestKey, available }: {
  access: PaymentAccess; members: Member[]; currentMemberId?: number; payments: PaymentHistory[]; requestKey: string; available: boolean;
}) {
  return <section aria-labelledby="payments-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <h2 id="payments-heading" className="text-xl font-semibold">Repayments</h2>
    <p className="mt-2 text-sm text-slate-600">SPLITMate records external payments; it does not transfer money. Only the owner can confirm or reject reports.</p>
    <p className="mt-2 text-sm text-slate-600">New payments and confirmations require active members. Pending reports reserve available debt and credit; rejected reports release it.</p>
    {available && currentMemberId ? <PaymentForm access={access} members={members} currentMemberId={currentMemberId} requestKey={requestKey} />
      : <p role="status" className="mt-4 text-sm">New payments are unavailable until balances and your active membership are available.</p>}
    <h3 className="mt-6 font-semibold">Payment history</h3>
    {payments.length === 0 ? <p className="mt-3 text-sm text-slate-600">No repayments recorded yet.</p> : <ul className="mt-3 space-y-4">
      {payments.map(payment => <li key={payment.id} className="rounded-xl border border-slate-200 p-4">
        <p className="break-words font-semibold">{payment.payerName} → {payment.receiverName} — £{payment.amount}</p>
        <p className="mt-1 text-sm font-semibold">{paymentStatusLabel(payment.status)}</p>
        <p className="mt-1 break-words text-xs text-slate-500">Recorded <time dateTime={payment.createdAt}>{payment.createdAt.replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC")}</time></p>
        {payment.status === "SENT" && <p className="mt-2 text-sm text-slate-600">Not yet applied to balances.</p>}
        {access.kind === "owner" && currentMemberId && payment.status === "SENT" && <PaymentReview groupId={access.groupId} payment={payment} currentMemberId={currentMemberId} />}
      </li>)}
    </ul>}
  </section>;
}
