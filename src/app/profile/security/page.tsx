import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ChangePasswordForm from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Security | SPLITMate" };
export default async function SecurityPage() {
  if (!await getCurrentUser()) redirect("/login?next=/profile/security");
  return <main className="min-h-screen bg-canvas px-6 py-12 text-foreground sm:py-20">
    <div className="mx-auto max-w-2xl">
      <Link href="/profile" className="rounded text-accent underline">Back to profile</Link>
      <h1 className="mt-8 text-3xl font-semibold">Account security</h1>
      <h2 className="mt-6 text-xl font-semibold">Password management</h2>
      <p className="mt-3 leading-7 text-muted">Changing your password signs you out of all existing owner sessions, including this browser. Sign in again with your new password afterward. Guest sessions are unaffected.</p>
      <ChangePasswordForm />
    </div>
  </main>;
}
