import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getGroupForGuest } from "@/data/guest-groups";
import { isValidToken } from "@/lib/auth/tokens";
import GuestSignOut from "@/components/groups/guest-sign-out";
import ExpenseList from "@/components/expenses/expense-list";
import MemberList from "@/components/groups/member-list";
import ActivityList from "@/components/groups/activity-list";
import BalanceList from "@/components/groups/balance-list";
import PaymentPanel from "@/components/groups/payment-panel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your group | SPLITMate", robots: { index: false, follow: false }, referrer: "no-referrer",
};
export default async function GuestGroupPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  if (!isValidToken(shareToken)) redirect("/g/invalid");
  let result: Awaited<ReturnType<typeof getGroupForGuest>>;
  try {
    result = await getGroupForGuest(shareToken);
  } catch {
    console.error("Guest group loading failed unexpectedly.");
    return (
      <main className="min-h-screen bg-canvas px-6 py-12 text-foreground">
        <div className="mx-auto max-w-lg">
          <Link href="/" className="font-semibold text-accent">SPLITMate</Link>
          <h1 className="mt-8 text-2xl font-semibold">Group temporarily unavailable</h1>
          <p className="mt-4 text-muted">Unable to load the group. Please refresh and try again.</p>
        </div>
      </main>
    );
  }
  if (!result) redirect(`/g/${shareToken}`);
  const { group, currentGuest, members, activity, expenses } = result;
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 font-sans text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm font-semibold text-accent">SPLITMate</Link>
        <header className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Shared group</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{group.name}</h1>
              <p className="mt-4 break-words text-sm text-accent">You&apos;re joined as <strong>{currentGuest.name}</strong>.</p>
              <p className="mt-2 text-sm text-muted">{members.length} active {members.length === 1 ? "member" : "members"} &middot; No account needed</p>
            </div>
            <Link href={`/g/${shareToken}/expenses/new`} className="shrink-0 rounded-xl bg-emerald-800 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Add expense</Link>
          </div>
        </header>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <BalanceList balances={result.balances} access={{ kind: "guest", shareToken }} currentMemberId={currentGuest.id} payments={result.payments} />
            <PaymentPanel payments={result.payments} />
            <section aria-labelledby="expenses-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
              <h2 id="expenses-heading" className="text-xl font-semibold">Expenses</h2>
              <p className="mt-1 text-sm text-muted">What your group has spent, and how each expense is shared.</p>
              <ExpenseList expenses={expenses} />
            </section>
            <ActivityList activity={activity} />
          </div>
          <div className="min-w-0 space-y-6">
            <MemberList members={members} currentMemberId={currentGuest.id} />
            <GuestSignOut shareToken={shareToken} />
          </div>
        </div>
      </div>
    </main>
  );
}
