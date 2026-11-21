import Link from "next/link";

const sections = [
  { href: "/profile", label: "Profile" },
  { href: "/profile/appearance", label: "Appearance" },
  { href: "/profile/security", label: "Security" },
] as const;

type SettingsPath = typeof sections[number]["href"];

/** Ordinary links preserve browser navigation without client-side tab state. */
export default function SettingsNavigation({ current }: { current: SettingsPath }) {
  return <nav aria-label="Account settings" className="mb-8">
    <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded px-2 font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">Back to dashboard</Link>
    <ul className="mt-4 grid grid-cols-1 gap-2 rounded-2xl border border-line bg-surface p-2 sm:grid-cols-3">
      {sections.map(({ href, label }) => <li key={href} className="min-w-0">
        <Link href={href} aria-current={current === href ? "page" : undefined} className={`flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${current === href ? "border-accent bg-accent-soft text-accent underline underline-offset-4" : "border-transparent text-muted hover:bg-subtle hover:text-foreground"}`}>{label}</Link>
      </li>)}
    </ul>
  </nav>;
}
