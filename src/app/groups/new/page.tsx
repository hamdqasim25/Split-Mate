import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CreateGroupForm from "@/components/groups/create-group-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create Group | SPLITMate",
  description: "Create a new SPLITMate group for shared expenses.",
};

export default async function CreateGroupPage() {
  if (!(await getCurrentUser())) {
    redirect("/login?next=/groups/new");
  }

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

        <CreateGroupForm />
      </div>
    </main>
  );
}