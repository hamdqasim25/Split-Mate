import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard | SPLITMate",
  description: "Your shared expenses and groups, all in one place.",
};

const groups = [
  {
    name: "Weekend Trip",
    members: 3,
    balance: "You are owed £40.00",
  },
  {
    name: "Football",
    members: 8,
    balance: "You owe £12.00",
  },
];

const activity = [
  {
    title: "Dinner together",
    detail: "Alex paid",
    amount: "£75.00",
  },
  {
    title: "Train tickets",
    detail: "Sam paid",
    amount: "£45.00",
  },
];

export default function Dashboard() {
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
              Keep track of your groups, expenses, and balances in one place.
            </p>
          </div>

          <Link
            href="/groups/new"
            className="inline-flex items-center justify-center rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-900"
          >
            + Create group
          </Link>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">You are owed</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-800">
              £40.00
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">You owe</p>
            <p className="mt-2 text-3xl font-semibold">
              £12.00
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-sm text-slate-500">Active groups</p>
            <p className="mt-2 text-3xl font-semibold">
              2
            </p>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              Your groups
            </h2>

            <Link
              href="/groups"
              className="text-sm font-semibold text-emerald-800"
            >
              View all
            </Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <div
                key={group.name}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-xl font-semibold">
                  {group.name}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {group.members} members
                </p>

                <p className="mt-5 font-semibold text-emerald-800">
                  {group.balance}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">
            Recent activity
          </h2>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white">
            {activity.map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between border-b border-slate-100 p-5 last:border-b-0"
              >
                <div>
                  <p className="font-semibold">
                    {item.title}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.detail}
                  </p>
                </div>

                <p className="font-semibold">
                  {item.amount}
                </p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
