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
    <main className="min-h-screen bg-canvas px-6 py-12 font-sans text-foreground sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-accent hover:text-accent"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            New group
          </p>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Create a group
          </h1>

          <p className="mt-4 max-w-xl text-lg leading-8 text-muted">
            Give your group a name and add the people who will be sharing
            expenses.
          </p>
        </div>

        <CreateGroupForm />
      </div>
    </main>
  );
}