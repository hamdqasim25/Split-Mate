import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Create Group | SPLITMate",
  description: "Create a new SPLITMate group for shared expenses.",
};

export default function CreateGroupPage() {
  return (
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
            New group
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Create a group
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
            Give your group a name and add the people who will be sharing
            expenses.
          </p>
        </div>

        <form className="mt-10 space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <label
              htmlFor="group-name"
              className="block text-sm font-semibold text-slate-900"
            >
              Group name
            </label>

            <input
              id="group-name"
              name="groupName"
              type="text"
              placeholder="e.g. Weekend trip"
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Add members</h2>

            <div className="mt-6 space-y-4">
              <input
                name="member1"
                type="text"
                placeholder="e.g. Alex"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />

              <input
                name="member2"
                type="text"
                placeholder="e.g. Sam"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"
              />
            </div>

            <button
              type="button"
              className="mt-5 text-sm font-semibold text-emerald-800"
            >
              + Add another member
            </button>
          </section>

          <div className="flex justify-end gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold"
            >
              Cancel
            </Link>

            <button
              type="submit"
              className="rounded-full bg-emerald-800 px-6 py-3 text-sm font-semibold text-white"
            >
              Create group
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}