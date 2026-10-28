import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getExpenseFormContext } from "@/data/expenses";
import ExpenseForm from "@/components/expenses/expense-form";
import { ownerExpenseAction } from "@/app/actions/expenses";

export const metadata: Metadata = { title: "Add expense | SPLITMate" };

export default async function OwnerExpensePage({ params }: { params: Promise<{ groupId: string }> }) {
  if (!await getCurrentUser()) redirect("/login?next=/dashboard");
  const { groupId } = await params;
  if (!/^[1-9]\d{0,9}$/.test(groupId) || Number(groupId) > 2_147_483_647) notFound();
  let context;
  try {
    context = await getExpenseFormContext({ kind: "owner", groupId: Number(groupId) });
  } catch {
    console.error("Owner expense form loading failed unexpectedly.");
    return <main className="min-h-screen bg-canvas p-6 text-foreground"><h1 className="text-2xl font-semibold">Expense form temporarily unavailable</h1><p>Please refresh and try again.</p></main>;
  }
  if (!context) notFound();
  return (
    <main className="min-h-screen bg-canvas px-6 py-12 font-sans text-foreground sm:py-20">
      <div className="mx-auto max-w-2xl">
        <Link href={`/groups/${groupId}`} className="text-sm font-semibold text-accent">Back to group</Link>
        <h1 className="mt-8 text-3xl font-semibold">Add expense</h1>
        <p className="mt-3 break-words text-muted">{context.group.name}</p>
        <ExpenseForm context={context} action={ownerExpenseAction.bind(null, Number(groupId))} requestKey={randomUUID()} />
      </div>
    </main>
  );
}
