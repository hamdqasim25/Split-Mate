import type { Metadata } from "next";
import SettingsNavigation from "@/components/settings-navigation";
import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/data/account";

export const metadata: Metadata = { title: "Profile | SPLITMate" };

export default async function ProfilePage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login?next=/profile");

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 font-sans text-foreground sm:px-6 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <SettingsNavigation current="/profile" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Profile</h1>
        <p className="mt-3 leading-7 text-muted">Your registered SPLITMate account details. These details are read-only.</p>
        <section aria-labelledby="account-information" className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <h2 id="account-information" className="text-xl font-semibold">Account information</h2>
          <dl className="mt-5 space-y-5">
            <div><dt className="text-sm text-muted">Registered name</dt><dd className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">{account.name}</dd></div>
            <div><dt className="text-sm text-muted">Registered email address</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{account.email}</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
