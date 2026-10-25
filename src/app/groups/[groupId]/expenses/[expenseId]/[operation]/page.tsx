import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ExpenseError } from "@/data/expenses";
import { getSavedExpenseForOwner } from "@/data/expense-management";
import { editExpenseAction, deleteExpenseAction } from "@/app/actions/expense-management";
import ExpenseForm from "@/components/expenses/expense-form";
import DeleteExpenseForm from "@/components/expenses/delete-expense-form";

export const metadata = { title: "Manage expense | SPLITMate" };

export default async function ManageExpensePage({ params }: { params: Promise<{ groupId: string; expenseId: string; operation: string }> }) {
  if (!await getCurrentUser()) redirect("/login?next=/dashboard");
  const { groupId, expenseId, operation } = await params;
  if (![groupId, expenseId].every(id => /^[1-9]\d{0,9}$/.test(id) && Number(id) <= 2_147_483_647) || !["edit", "delete"].includes(operation)) notFound();
  let saved;
  try { saved = await getSavedExpenseForOwner(Number(groupId), Number(expenseId)); }
  catch (error) {
    if (!(error instanceof ExpenseError)) console.error("Saved expense loading failed unexpectedly.");
    return <main className="min-h-screen bg-canvas p-6 text-foreground"><h1 className="text-2xl font-semibold">Expense unavailable</h1><p className="mt-3">It may have changed or been removed, or your owner access may have expired. Return to the group and try again.</p><Link href={`/groups/${groupId}`} className="mt-4 inline-flex min-h-11 items-center text-accent">Back to group</Link></main>;
  }
  const editing = operation === "edit";
  return <main className="min-h-screen bg-canvas px-4 py-8 text-foreground sm:px-6 sm:py-12"><div className="mx-auto max-w-2xl">
    <Link href={`/groups/${groupId}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-accent">Cancel and return to group</Link>
    <h1 className="mt-4 text-3xl font-semibold">{editing ? "Edit expense" : "Delete expense?"}</h1>
    {editing ? <ExpenseForm key={`${expenseId}:${saved.version}`} context={saved.context} initialInput={saved.input} editing action={editExpenseAction.bind(null, Number(groupId), Number(expenseId), saved.version)} /> :
      <section className="mt-5 rounded-xl border border-line bg-surface p-5">
        <h2 className="break-words text-lg font-semibold">{saved.input.description}</h2><p className="mt-2 font-semibold tabular-nums">£{saved.input.amount}</p>
        <p className="mt-3 text-sm text-muted">This removes the expense and its shares from balances and dashboard totals. Payment amounts linked to this expense will also be excluded; amounts linked to other expenses stay effective. Payment history is retained. Historical payments must be reconciled first. You cannot undo this deletion.</p>
        <DeleteExpenseForm action={deleteExpenseAction.bind(null, Number(groupId), Number(expenseId), saved.version)} />
      </section>}
  </div></main>;
}
