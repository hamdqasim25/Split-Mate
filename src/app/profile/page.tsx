import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/data/account";

export const metadata: Metadata = { title: "Profile | SPLITMate" };

export default async function ProfilePage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login?next=/profile");

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 font-sans text-foreground sm:py-20">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="rounded font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Back to dashboard</Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">Your profile</h1>
        <p className="mt-3 text-muted">Your registered SPLITMate account details.</p>
        <section aria-labelledby="account-information" className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <h2 id="account-information" className="text-xl font-semibold">Account information</h2>
          <dl className="mt-5 space-y-5">
            <div><dt className="text-sm text-muted">Registered name</dt><dd className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">{account.name}</dd></div>
            <div><dt className="text-sm text-muted">Registered email address</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{account.email}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="account-security" className="mt-6 rounded-2xl border border-line bg-surface p-6">
          <h2 id="account-security" className="text-xl font-semibold">Account security</h2>
          <p className="mt-3 leading-7 text-muted">Password management will be added in a later update.</p>
        </section>
      </div>
    </main>
  );
}
