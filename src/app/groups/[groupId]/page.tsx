import { randomUUID } from "node:crypto";
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

export const metadata: Metadata = {
  title: "Group details | SPLITMate",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
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
  return (
    <main className="min-h-screen bg-[#f8faf7] px-4 py-8 font-sans text-slate-900 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="text-sm font-semibold text-emerald-800 hover:text-emerald-950">Back to dashboard</Link>
        <header className="mt-6 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">Your group</p>
              <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{group.name}</h1>
              {group.description && <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words leading-7 text-slate-600">{group.description}</p>}
              <p className="mt-4 break-words text-sm text-emerald-900">You&apos;re here as <strong>{currentMember?.name ?? user.name}</strong> <span className="ml-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold">Owner</span></p>
            </div>
            <Link href={`/groups/${group.id}/expenses/new`} className="shrink-0 rounded-xl bg-emerald-800 px-5 py-3 text-center font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">Add expense</Link>
          </div>
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-5 text-sm">
            <div><dt className="text-slate-500">Currency</dt><dd className="mt-1 font-semibold">{group.currency}</dd></div>
            <div><dt className="text-slate-500">Active members</dt><dd className="mt-1 font-semibold">{members.length}</dd></div>
            <div><dt className="text-slate-500">Created</dt><dd className="mt-1 font-semibold"><time dateTime={group.createdAt}>{dateFormat.format(new Date(group.createdAt))}</time></dd></div>
          </dl>
        </header>
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-6">
            <BalanceList balances={result.balances} />
            <PaymentPanel access={{ kind: "owner", groupId: group.id }} members={members} currentMemberId={currentMember?.id} payments={result.payments} requestKey={randomUUID()} available={result.balances.status === "ready"} />
            <section aria-labelledby="expenses-heading" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 id="expenses-heading" className="text-xl font-semibold">Expenses</h2>
              <p className="mt-1 text-sm text-slate-500">What your group has spent, and how each expense is shared.</p>
              <ExpenseList expenses={expenses} />
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
