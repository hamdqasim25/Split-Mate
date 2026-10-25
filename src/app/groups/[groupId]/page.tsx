import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGroupForOwner } from "@/data/groups";
import { getCurrentUser } from "@/lib/auth/session";
import ShareLink from "@/components/groups/share-link";
import ExpenseList from "@/components/expenses/expense-list";
import MemberList from "@/components/groups/member-list";
import ActivityList from "@/components/groups/activity-list";
import BalanceList from "@/components/groups/balance-list";
import PaymentPanel from "@/components/groups/payment-panel";
import DeleteGroupButton from "@/components/groups/delete-group-button";

export const metadata: Metadata = {
  title: "Group details | SPLITMate",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams?: Promise<{ expense?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { groupId } = await params;

  // Accept only positive decimal IDs within the database's Int range.
  if (!/^[1-9]\d{0,9}$/.test(groupId)) {
    notFound();
  }

  const id = Number(groupId);

  if (id > 2_147_483_647) {
    notFound();
  }

  // Ownership is checked by the service using the verified session's User ID.
  const result = await getGroupForOwner(user.id, id);

  if (!result) {
    notFound();
  }

  const { group, members, activity, expenses, currentMember } = result;
  const expenseStatus = (await searchParams)?.expense;
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 font-sans text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm font-semibold text-accent hover:text-accent">Back to dashboard</Link>
        {["updated", "deleted"].includes(expenseStatus ?? "") && <p role="status" className="mt-4 rounded-xl bg-accent-soft p-3 text-sm text-accent">Expense {expenseStatus}. Balances have been refreshed; payment history is retained.{expenseStatus === "deleted" ? " Linked payment amounts are excluded." : ""}</p>}
        <header className="mt-6 rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">Your group</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{group.name}</h1>
              {group.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words leading-7 text-muted">{group.description}</p>}
              <p className="mt-4 break-words text-sm text-accent">You&apos;re here as <strong>{currentMember?.name ?? user.name}</strong> <span className="ml-1 rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold">Owner</span></p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link href={`/groups/${group.id}/expenses/new`} className="rounded-xl bg-emerald-800 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Add expense</Link>
              <DeleteGroupButton groupId={group.id} groupName={group.name} />
            </div>
          </div>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-5 text-sm">
            <div><dt className="text-muted">Currency</dt><dd className="mt-1 font-semibold">{group.currency}</dd></div>
            <div><dt className="text-muted">Active members</dt><dd className="mt-1 font-semibold">{members.length}</dd></div>
            <div><dt className="text-muted">Created</dt><dd className="mt-1 font-semibold"><time dateTime={group.createdAt}>{dateFormat.format(new Date(group.createdAt))}</time></dd></div>
          </dl>
        </header>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <BalanceList balances={result.balances} access={{ kind: "owner", groupId: group.id }} currentMemberId={currentMember?.id} payments={result.payments} paymentExpenses={result.paymentExpenses} />
            <PaymentPanel payments={result.payments} ownerGroupId={group.id} currentMemberId={currentMember?.id} />
            <section aria-labelledby="expenses-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
              <h2 id="expenses-heading" className="text-xl font-semibold">Expenses</h2>
              <p className="mt-1 text-sm text-muted">What your group has spent, and how each expense is shared.</p>
              <ExpenseList expenses={expenses} ownerGroupId={group.id} />
            </section>
            <ActivityList activity={activity} />
          </div>
          <div className="min-w-0 space-y-6">
            <MemberList members={members.map(member => ({ id: member.id, name: member.name, joined: member.claimedAt !== null, role: member.role }))} currentMemberId={currentMember?.id} />
            <ShareLink shareToken={group.shareToken} shareLinkEnabled={group.shareLinkEnabled} />
          </div>
        </div>
      </div>
    </main>
  );
}
