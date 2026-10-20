import type { SavedExpense } from "@/lib/expenses/types";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });

export default function ExpenseList({ expenses }: { expenses: SavedExpense[] }) {
  if (expenses.length === 0) return <div className="mt-5 rounded-xl border border-dashed border-line bg-subtle px-5 py-8 text-center"><p className="font-semibold">No expenses yet</p><p className="mt-2 text-sm text-muted">Paid for something together? Add the first expense and choose everyone who took part.</p></div>;
  return (
    <div className="mt-4">
      <p className="text-sm text-muted">Latest expenses (up to 50). Amounts in GBP.</p>
      <ul className="mt-4 space-y-4">
        {expenses.map(expense => (
          <li key={expense.id} className="space-y-3 rounded-xl border border-line p-4 sm:p-5">
            <div className="flex flex-wrap justify-between gap-3"><h3 className="min-w-0 flex-1 break-words font-semibold">{expense.description}</h3><span className="shrink-0 text-lg font-semibold tabular-nums">£{expense.amount}</span></div>
            <p className="break-words text-sm text-muted">Paid by {expense.payerName} · {expense.participantCount} {expense.participantCount === 1 ? "participant" : "participants"} · {expense.splitMethod === "CUSTOM" ? "Custom split" : "Equal split"}</p>
            <time dateTime={expense.createdAt} className="text-sm text-muted">{dateFormat.format(new Date(expense.createdAt))} (London)</time>
            <details className="border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-accent">View split amounts</summary>
              <ul className="mt-3 space-y-2">
                {expense.participants.map(member => <li key={member.id} className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words text-muted">{member.name}</span><span className="shrink-0 tabular-nums">£{member.amount}</span></li>)}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
