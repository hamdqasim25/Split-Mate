/** Runs synchronously in the document head, before the page can paint. Kept
 * self-contained so the same implementation can be tested and inlined. */
export function initializeTheme(browser: Window = window) {
  const key = "splitmate-theme";
  const root = browser.document.documentElement;
  const system = browser.matchMedia("(prefers-color-scheme: dark)");
  let preference: string | null = null;
  try { preference = browser.localStorage.getItem(key); } catch { /* Storage may be blocked. */ }
  const apply = () => {
    const theme = preference === "light" || preference === "dark" ? preference : system.matches ? "dark" : "light";
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  };
  const choose = () => {
    preference = root.dataset.theme === "dark" ? "light" : "dark";
    try { browser.localStorage.setItem(key, preference); } catch { /* Keep the choice for this page. */ }
    apply();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) { preference = event.newValue; apply(); }
  };
  // Native button activation covers touch, mouse, Enter and Space before React
  // hydrates. Delegation also covers replacement buttons after navigation.
  const click = (event: MouseEvent) => {
    const target = event.target as Element | null;
    if (target?.closest?.("button[data-theme-toggle]")) choose();
  };
  apply();
  browser.document.addEventListener("click", click);
  browser.addEventListener("storage", storage);
  // Older WebKit exposes addListener only. Do not let optional system-change
  // subscription prevent manual selection from working.
  if (typeof system.addEventListener === "function") system.addEventListener("change", apply);
  else if (typeof system.addListener === "function") system.addListener(apply);
  return () => {
    if (typeof system.removeEventListener === "function") system.removeEventListener("change", apply);
    else if (typeof system.removeListener === "function") system.removeListener(apply);
    browser.document.removeEventListener("click", click);
    browser.removeEventListener("storage", storage);
  };
}
