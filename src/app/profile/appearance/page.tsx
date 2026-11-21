import type { Metadata } from "next";
import SettingsNavigation from "@/components/settings-navigation";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ThemeToggle from "@/components/theme-toggle";

export const metadata: Metadata = { title: "Appearance | SPLITMate" };
export default async function AppearancePage() {
  if (!await getCurrentUser()) redirect("/login?next=/profile/appearance");
  return <main className="min-h-screen bg-canvas px-4 py-8 font-sans text-foreground sm:px-6 sm:py-12">
    <div className="mx-auto max-w-2xl">
      <SettingsNavigation current="/profile/appearance" />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Appearance</h1>
      <p className="mt-3 leading-7 text-muted">Choose how SPLITMate looks in this browser.</p>
      <section aria-labelledby="colour-theme" className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <h2 id="colour-theme" className="text-xl font-semibold">Light and dark mode</h2>
        <p className="my-4 leading-7 text-muted">Choose a comfortable theme for this browser. Your device preference is used until you choose light or dark mode. Your choice is remembered when browser storage is available.</p>
        <ThemeToggle />
      </section>
    </div>
  </main>;
}
