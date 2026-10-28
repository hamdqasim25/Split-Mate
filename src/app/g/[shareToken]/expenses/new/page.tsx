import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isValidToken } from "@/lib/auth/tokens";
import { getExpenseFormContext } from "@/data/expenses";
import ExpenseForm from "@/components/expenses/expense-form";
import { guestExpenseAction } from "@/app/actions/expenses";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add expense | SPLITMate", robots: { index: false, follow: false }, referrer: "no-referrer",
};

export default async function GuestExpensePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  if (!isValidToken(shareToken)) redirect("/g/invalid");
  let context;
  try {
    context = await getExpenseFormContext({ kind: "guest", shareToken });
  } catch {
    console.error("Guest expense form loading failed unexpectedly.");
    return <main className="min-h-screen bg-canvas p-6 text-foreground"><h1 className="text-2xl font-semibold">Expense form temporarily unavailable</h1><p>Please refresh and try again.</p></main>;
  }
  if (!context) redirect(`/g/${shareToken}`);
  return (
    <main className="min-h-screen bg-canvas px-6 py-12 font-sans text-foreground sm:py-20">
      <div className="mx-auto max-w-2xl">
        <Link href={`/g/${shareToken}/group`} className="text-sm font-semibold text-accent">Back to group</Link>
        <h1 className="mt-8 text-3xl font-semibold">Add expense</h1>
        <p className="mt-3 break-words text-muted">{context.group.name}</p>
        <ExpenseForm context={context} action={guestExpenseAction.bind(null, shareToken)} requestKey={randomUUID()} />
      </div>
    </main>
  );
}
