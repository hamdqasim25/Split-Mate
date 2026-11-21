import type { Metadata } from "next";
import SettingsNavigation from "@/components/settings-navigation";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ChangePasswordForm from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Security | SPLITMate" };
export default async function SecurityPage() {
  if (!await getCurrentUser()) redirect("/login?next=/profile/security");
  return <main className="min-h-screen bg-canvas px-4 py-8 font-sans text-foreground sm:px-6 sm:py-12">
    <div className="mx-auto max-w-2xl">
      <SettingsNavigation current="/profile/security" />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Security</h1>
      <p className="mt-3 leading-7 text-muted">Manage your account password.</p>
      <h2 className="mt-6 text-xl font-semibold">Password management</h2>
      <p className="mt-3 leading-7 text-muted">Changing your password signs you out of all existing owner sessions, including this browser. Sign in again with your new password afterward. Guest sessions are unaffected.</p>
      <ChangePasswordForm />
    </div>
  </main>;
}
