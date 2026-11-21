import Link from "next/link";
import AccountMenu from "@/components/account-menu";
import ThemeToggle from "@/components/theme-toggle";
import { getVisitorState } from "@/lib/auth/visitor";

export default async function AppHeader() {
  const visitor = await getVisitorState();
  return <header className="border-b border-line bg-surface px-4 py-3 sm:px-6">
    <nav aria-label="Application controls" className="mx-auto flex max-w-6xl items-center justify-between gap-3">
      <Link href="/" aria-label="SPLITMate home" className="inline-flex min-h-11 items-center gap-2.5 rounded text-xl font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"><span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-emerald-800 text-2xl text-white">÷</span><span>SPLIT<span className="text-accent">Mate</span></span></Link>
      <div className="flex shrink-0 items-center gap-2"><ThemeToggle /><AccountMenu visitor={visitor} /></div>
    </nav>
  </header>;
}
