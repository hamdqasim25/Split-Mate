import type { GroupBalances } from "@/data/balances";
import { randomUUID } from "node:crypto";
import { paymentOptions, canConfirmPayment } from "@/lib/payments/eligibility";
import type { PaymentAccess, PaymentHistory } from "@/lib/payments/types";
import { PaymentForm, PaymentReview } from "@/components/groups/payment-panel";
import { formatPence, parsePence } from "@/lib/expenses/money";

export default function BalanceList({ balances, access, currentMemberId, payments = [] }: {
  balances: GroupBalances; access?: PaymentAccess; currentMemberId?: number; payments?: PaymentHistory[];
}) {
  const actorActive = balances.status === "ready" && balances.members.some(member => member.id === currentMemberId && member.isActive);
  return (
    <section aria-labelledby="balances-heading" className="rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 id="balances-heading" className="text-xl font-semibold">Member balances</h2>
      <p className="mt-1 text-xs leading-5 text-muted">Balances include confirmed payments only.</p>
      {balances.status === "unavailable" ? (
        <p role="alert" className="mt-4 rounded-xl bg-warning-soft p-4 text-sm text-warning">Balances unavailable. The ledger could not be reconciled in GBP. No balances are shown; ask the group owner to investigate the recorded expenses.</p>
      ) : <>
        {balances.expenseCount === 0 && <p className="mt-4 rounded-xl bg-subtle p-4 text-sm text-muted">No expenses yet. Add an expense to start tracking what the group owes.</p>}
        <ul className="mt-3 divide-y divide-line">
          {balances.members.map(member => {
            const recipients = paymentOptions(balances, payments, member.id);
            const pending = payments.filter(payment => payment.status === "SENT" && payment.payerMemberId === member.id);
            const pendingAmount = formatPence(pending.reduce((sum, payment) => sum + BigInt(parsePence(payment.amount)), BigInt(0)));
            const canReport = actorActive && access && (access.kind === "owner" || member.id === currentMemberId);
            return (
            <li key={member.id} className="balance-row min-w-0 gap-x-2 py-1 text-sm md:py-2.5">
              <h3 tabIndex={-1} className="balance-row-name min-w-0 break-words font-medium leading-5">{member.name}{member.id === currentMemberId && <span className="ml-1 inline-block text-xs font-normal text-muted">You</span>}{!member.isActive && <span className="ml-1 inline-block text-xs font-normal text-muted">Inactive member</span>}</h3>
              <p className="balance-row-amount min-w-0 break-words text-right text-base font-semibold leading-6 tabular-nums">{member.net === "0.00" ? "Even" : member.net.startsWith("-") ? `Owes £${member.net.slice(1)}` : `Is owed £${member.net}`}</p>
              {canReport && member.isActive && <PaymentForm access={access} senderId={member.id} recipients={recipients} requestKey={randomUUID()} />}
              <details className="balance-breakdown min-w-0">
                <summary className="flex min-h-11 cursor-pointer items-center justify-end text-xs font-semibold text-accent">View breakdown<span className="sr-only"> for {member.name}</span></summary>
              <dl className="mb-2 grid gap-2 rounded-lg bg-subtle p-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted">Paid</dt><dd className="break-all tabular-nums">£{member.paid}</dd></div>
                <div><dt className="text-muted">Allocated share</dt><dd className="break-all tabular-nums">£{member.share}</dd></div>
                <div><dt className="text-muted">Confirmed sent</dt><dd className="break-all tabular-nums">£{member.sent}</dd></div>
                <div><dt className="text-muted">Confirmed received</dt><dd className="break-all tabular-nums">£{member.received}</dd></div>
              </dl>
              </details>
              {pending.length > 0 && <details className="col-span-full min-w-0">
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-3 text-xs text-muted">
                  <span className="break-words tabular-nums">£{pendingAmount} awaiting confirmation</span>
                  <span className="font-semibold text-accent">View pending reports<span className="sr-only"> from {member.name}</span></span>
                </summary>
                {pending.map(payment => <div key={payment.id} className="mb-2 rounded-lg bg-subtle p-3">
                  <p className="break-words text-sm font-semibold">To {payment.receiverName} — £{payment.amount}</p>
                  {access?.kind === "owner" && actorActive && currentMemberId && <PaymentReview groupId={access.groupId} payment={payment} currentMemberId={currentMemberId} canConfirm={canConfirmPayment(balances, payments, payment)} />}
                </div>)}
              </details>}
            </li>
          );})}
        </ul>
      </>}
    </section>
  );
}
