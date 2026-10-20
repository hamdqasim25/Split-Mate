export default function ThemeToggle() {
  return <button type="button" data-theme-toggle="" className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-subtle">
    <span className="theme-when-light">Switch to dark mode</span>
    <span className="theme-when-dark">Switch to light mode</span>
  </button>;
}
