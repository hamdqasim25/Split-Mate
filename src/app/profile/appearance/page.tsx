import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Appearance | SPLITMate" };
export default async function AppearancePage() {
  if (!await getCurrentUser()) redirect("/login?next=/profile/appearance");
  return <main className="min-h-screen bg-canvas px-6 py-12 text-foreground sm:py-20">
    <div className="mx-auto max-w-2xl">
      <nav aria-label="Settings navigation" className="flex flex-wrap gap-6 text-accent">
        <Link href="/dashboard" className="rounded underline">Dashboard</Link>
        <Link href="/profile" className="rounded underline">Profile</Link>
      </nav>
      <h1 className="mt-8 text-3xl font-semibold">Appearance</h1>
      <section aria-labelledby="colour-theme" className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 id="colour-theme" className="text-xl font-semibold">Light and dark mode</h2>
        <p className="my-4 leading-7 text-muted">Choose a comfortable theme for this browser. Your device preference is used until you choose light or dark mode. Your choice is remembered when browser storage is available.</p>
        <ThemeToggle />
      </section>
    </div>
  </main>;
}
