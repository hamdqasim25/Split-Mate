/** Native control handled by the layout's delegated theme bootstrap, even before hydration.
 * CSS selects the appropriate label; no second React click handler is needed. */
export default function ThemeToggle() {
  return <button type="button" data-theme-toggle="" className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border border-line bg-surface h-11 w-11 text-sm font-semibold text-foreground hover:bg-subtle active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent">
    <span className="theme-when-light"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg><span className="sr-only">Switch to dark mode</span></span>
    <span className="theme-when-dark"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg><span className="sr-only">Switch to light mode</span></span>
  </button>;
}
