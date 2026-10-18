import type { GroupBalances } from "@/data/balances";

export default function BalanceList({ balances }: { balances: GroupBalances }) {
  return (
    <section aria-labelledby="balances-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="balances-heading" className="text-xl font-semibold">Member balances</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">Expenses paid minus allocated share, plus confirmed repayments sent minus confirmed repayments received. Awaiting-confirmation and rejected payments do not change balances.</p>
      {balances.status === "unavailable" ? (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Balances unavailable. The ledger could not be reconciled in GBP. No balances are shown; ask the group owner to investigate the recorded expenses.</p>
      ) : <>
        {balances.expenseCount === 0 && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No expenses yet. Add an expense to start tracking what the group owes.</p>}
        <ul className="mt-4 space-y-4">
          {balances.members.map(member => (
            <li key={member.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
              <h3 className="break-words font-semibold">{member.name}{!member.isActive && <span className="ml-2 text-xs font-normal text-slate-500">Inactive member</span>}</h3>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-slate-500">Paid</dt><dd className="break-all tabular-nums">£{member.paid}</dd></div>
                <div><dt className="text-slate-500">Allocated share</dt><dd className="break-all tabular-nums">£{member.share}</dd></div>
                <div><dt className="text-slate-500">Confirmed sent</dt><dd className="break-all tabular-nums">£{member.sent}</dd></div>
                <div><dt className="text-slate-500">Confirmed received</dt><dd className="break-all tabular-nums">£{member.received}</dd></div>
                <div><dt className="text-slate-500">Net balance</dt><dd className="break-words font-semibold tabular-nums">{member.net === "0.00" ? "Even" : member.net.startsWith("-") ? `Owes £${member.net.slice(1)}` : `Is owed £${member.net}`}</dd></div>
              </dl>
            </li>
          ))}
        </ul>
      </>}
    </section>
  );
}
