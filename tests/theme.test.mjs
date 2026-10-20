import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { initializeTheme } from "../src/lib/theme.ts";
function environment(preference = null, dark = false, blocked = false) {
  const browser = new EventTarget();
  const system = new EventTarget(); system.matches = dark;
  const values = new Map(preference === null ? [] : [["splitmate-theme", preference]]);
  browser.document = Object.assign(new EventTarget(), { documentElement: { dataset: {}, style: {} } });
  browser.localStorage = { getItem: key => { if (blocked) throw Error("blocked"); return values.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw Error("blocked"); values.set(key, value); } };
  browser.matchMedia = () => system;
  return { browser, system, values, root: browser.document.documentElement };
}
function activate(e, matches = true) {
  const event = new Event("click");
  Object.defineProperty(event, "target", { value: { closest: selector => matches && selector === "button[data-theme-toggle]" ? {} : null } });
  e.browser.document.dispatchEvent(event);
}
for (const dark of [false, true]) test("first visit follows system and subsequent system changes: " + dark, () => {
  const e = environment(null, dark); const cleanup = initializeTheme(e.browser);
  assert.equal(e.root.dataset.theme, dark ? "dark" : "light");
  e.system.matches = !dark; e.system.dispatchEvent(new Event("change"));
  assert.equal(e.root.dataset.theme, dark ? "light" : "dark");
  assert.equal(e.root.style.colorScheme, e.root.dataset.theme);
  assert.equal(e.values.size, 0); cleanup();
});
for (const choice of ["light", "dark"]) test("explicit choice wins, survives reload and ignores system: " + choice, () => {
  const e = environment(choice, choice !== "dark"); initializeTheme(e.browser);
  assert.equal(e.root.dataset.theme, choice);
  e.system.dispatchEvent(new Event("change")); assert.equal(e.root.dataset.theme, choice);
  activate(e);
  const next = choice === "light" ? "dark" : "light";
  assert.equal(e.values.get("splitmate-theme"), next);
  const reload = environment(next); initializeTheme(reload.browser);
  assert.equal(reload.root.dataset.theme, next);
});
test("blocked storage still permits system preference and an in-page explicit selection", () => {
  const e = environment(null, true, true); initializeTheme(e.browser);
  assert.equal(e.root.dataset.theme, "dark");
  activate(e);
  e.system.dispatchEvent(new Event("change")); assert.equal(e.root.dataset.theme, "light");
});
test("invalid saved choices fall back to system; storage updates synchronize tabs", () => {
  const e = environment("invalid", true); initializeTheme(e.browser);
  assert.equal(e.root.dataset.theme, "dark");
  e.browser.dispatchEvent(Object.assign(new Event("storage"), { key: "splitmate-theme", newValue: "light" }));
  assert.equal(e.root.dataset.theme, "light");
  e.browser.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
  assert.equal(e.root.dataset.theme, "dark");
});
test("head bootstrap is self-contained and executes without a hydration-dependent effect", () => {
  const e = environment("dark");
  runInNewContext("(" + initializeTheme.toString() + ")();", { window: e.browser });
  assert.equal(e.root.dataset.theme, "dark");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert.ok(layout.indexOf("<script") < layout.indexOf("<body"));
  assert.match(layout, /suppressHydrationWarning/);
  const toggle = readFileSync("src/components/theme-toggle.tsx", "utf8");
  assert.match(toggle, /Switch to dark mode/); assert.match(toggle, /Switch to light mode/);
});
function luminance(hex) {
  const rgb = hex.match(/../g).map(part => parseInt(part, 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

test("legacy media-query API does not abort manual theme selection", () => {
  const e = environment(null, true);
  let listener;
  e.system.addEventListener = undefined;
  e.system.removeEventListener = undefined;
  e.system.addListener = callback => { listener = callback; };
  e.system.removeListener = callback => { assert.equal(callback, listener); listener = null; };
  const cleanup = initializeTheme(e.browser);
  e.system.matches = false; listener();
  assert.equal(e.root.dataset.theme, "light");
  activate(e);
  assert.equal(e.root.dataset.theme, "dark");
  assert.equal(e.values.get("splitmate-theme"), "dark");
  cleanup(); assert.equal(listener, null);
});

test("native activation works before hydration and on a replaced navigation button exactly once", () => {
  const e = environment(null, false);
  initializeTheme(e.browser);
  activate(e, false); assert.equal(e.root.dataset.theme, "light");
  activate(e); assert.equal(e.root.dataset.theme, "dark");
  activate(e); assert.equal(e.root.dataset.theme, "light");
  const source = readFileSync("src/components/theme-toggle.tsx", "utf8");
  assert.match(source, /<button type="button" data-theme-toggle/);
  assert.match(source, /min-h-11 min-w-11 touch-manipulation/);
  assert.doesNotMatch(source, /onClick|onTouch|use client/);
});

test("manual activation still works without any media-query subscription API", () => {
  const e = environment();
  e.system.addEventListener = undefined; e.system.removeEventListener = undefined;
  const cleanup = initializeTheme(e.browser);
  activate(e); assert.equal(e.root.dataset.theme, "dark");
  cleanup(); activate(e); assert.equal(e.root.dataset.theme, "dark");
});
test("semantic text and alert token pairs have at least 4.5:1 contrast in both themes", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  for (const block of [css.split(":root {")[1].split("}")[0], css.split(':root[data-theme="dark"] {')[1].split("}")[0]]) {
    const tokens = Object.fromEntries([...block.matchAll(/--([a-z-]+): #([0-9a-f]{6});/g)].map(m => [m[1], luminance(m[2])]));
    for (const [fg, bg] of [["foreground", "background"], ["foreground", "surface"], ["muted", "surface"], ["muted", "subtle"], ["accent", "surface"], ["accent", "accent-soft"], ["danger", "danger-soft"], ["warning", "warning-soft"]]) {
      const ratio = (Math.max(tokens[fg], tokens[bg]) + .05) / (Math.min(tokens[fg], tokens[bg]) + .05);
      assert.ok(ratio >= 4.5, fg + "/" + bg + " contrast " + ratio);
    }
  }
});
