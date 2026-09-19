import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getGroupsForOwner } from "@/data/groups";
import { signOut } from "@/app/actions/auth";

export const metadata: Metadata = {
  title: "Dashboard | SPLITMate",
  description: "Your shared expenses and groups, all in one place.",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

const activityDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export default async function Dashboard() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { groups, activity } = await getGroupsForOwner(user.id);

  const groupNames = new Map(
    groups.map((group) => [group.id, group.name]),
  );

  return (
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
        >
          ← Back to home
        </Link>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Your dashboard
            </h1>

            <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Welcome back, {user.name}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/groups/new"
              className="inline-flex items-center justify-center rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-900 active:bg-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            >
              + Create group
            </Link>

            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex cursor-pointer items-center justify-center rounded-full border border-emerald-800/30 bg-white px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:border-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">You are owed</p>

            <p className="mt-2 text-3xl font-semibold text-emerald-800">
              —
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Available once expenses are added
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">You owe</p>

            <p className="mt-2 text-3xl font-semibold">
              —
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Available once expenses are added
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Active groups</p>

            <p className="mt-2 text-3xl font-semibold">
              {groups.length}
            </p>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              Your groups
            </h2>
          </div>

          {groups.length === 0 && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-xl font-semibold">
                No groups yet
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                Create your first SPLITMate group to start tracking shared
                expenses.
              </p>

              <Link
                href="/groups/new"
                className="mt-4 inline-block font-semibold text-emerald-800 underline"
              >
                Create your first group
              </Link>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-emerald-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="break-words text-xl font-semibold group-hover:text-emerald-900">
                      {group.name}
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {group.members}{" "}
                      {group.members === 1 ? "member" : "members"} ·{" "}
                      {group.currency}
                    </p>
                  </div>

                  <span
                    aria-hidden="true"
                    className="shrink-0 text-lg text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-800"
                  >
                    →
                  </span>
                </div>

                {group.description && (
                  <p className="mt-3 break-words text-sm text-slate-600">
                    {group.description}
                  </p>
                )}

                <p className="mt-5 text-sm text-slate-500">
                  Created{" "}
                  <time dateTime={group.createdAt}>
                    {dateFormat.format(new Date(group.createdAt))}
                  </time>
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">
            Recent activity
          </h2>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
            {activity.length === 0 && (
              <p className="p-5 text-sm text-slate-600">
                No activity yet. Group updates will appear here.
              </p>
            )}

            {activity.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 border-b border-slate-100 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 break-words">
                  <p className="font-semibold">
                    {item.description}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {groupNames.get(item.groupId)}
                  </p>
                </div>

                <time
                  dateTime={item.createdAt}
                  className="shrink-0 text-sm text-slate-500"
                >
                  {activityDateFormat.format(
                    new Date(item.createdAt),
                  )}{" "}
                  (London)
                </time>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}