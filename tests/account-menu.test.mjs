import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { test } from "node:test";
import ts from "typescript";
const runtime = `data:text/javascript,${encodeURIComponent(`
export const state = { slot: {}, ref: { current: null }, effects: [] };
export function useRef() { return state.ref; }
export function useEffect(effect) { state.effects.push(effect); }
export function useSyncExternalStore() { return state.slot; }
export function createPortal(tree, slot) { return tree; }
export async function signOut() {}
export default function Link() {}
`)}`;
const hooks = registerHooks({
 resolve(specifier, context, next) {
  if (["react-dom", "next/link", "@/app/actions/auth"].includes(specifier) || (specifier === "react" && context.parentURL?.endsWith("/account-menu.tsx"))) return { url: runtime, shortCircuit: true };
  return next(specifier, context);
 },
 load(url, context, next) {
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText };
  return next(url, context);
 },
});
const { state, signOut } = await import(runtime);
const { default: AccountMenu } = await import("../src/components/account-menu.tsx");
const { default: ThemeToggle } = await import("../src/components/theme-toggle.tsx");
hooks.deregister();
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
test("account disclosure uses ordinary links, native expanded semantics and existing sign out", () => {
 state.slot = {}; const tree = AccountMenu({ visitor: "owner" }); const all = nodes(tree);
 assert.equal(tree.type, "details");
 assert.equal(all.find(n => n.type === "summary").props["aria-label"], "Account navigation");
 assert.deepEqual(all.filter(n => n.props?.href).map(n => n.props.href), ["/profile", "/profile/appearance", "/profile/security"]);
 assert.equal(all.find(n => n.type === "form").props.action, signOut);
 assert.ok(!all.some(n => ["menu", "menuitem"].includes(n.props?.role)));
 state.ref.current = { open: true };
 all.find(n => n.props?.href === "/profile").props.onClick();
 assert.equal(state.ref.current.open, false);
});
test("dismissal handles outside pointer, focus leaving and Escape with focus restoration", () => {
 const oldDocument = globalThis.document; const oldNode = globalThis.Node;
 class MockNode {}
 globalThis.Node = MockNode;
 const listeners = new Map();
 globalThis.document = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { assert.equal(listeners.get(name), fn); listeners.delete(name); } };
 try {
  state.effects = []; state.slot = {}; AccountMenu({ visitor: "owner" });
  let focused = false; const inside = new MockNode();
  state.ref.current = { open: true, contains: node => node === inside, querySelector: () => ({ focus: () => { focused = true; } }) };
  const cleanup = state.effects[0]();
  listeners.get("pointerdown")({ target: inside }); assert.equal(state.ref.current.open, true);
  listeners.get("pointerdown")({ target: new MockNode() }); assert.equal(state.ref.current.open, false);
  state.ref.current.open = true; listeners.get("focusin")({ target: new MockNode() }); assert.equal(state.ref.current.open, false);
  state.ref.current.open = true; let prevented = false;
  listeners.get("keydown")({ key: "Escape", preventDefault: () => { prevented = true; } });
  assert.equal(state.ref.current.open, false); assert.ok(focused && prevented);
  cleanup(); assert.equal(listeners.size, 0);
 } finally { if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument; if (oldNode === undefined) delete globalThis.Node; else globalThis.Node = oldNode; }
});
for (const visitor of ["guest", "signed-out"]) test(`${visitor} receives public navigation only`, () => {
 const all = nodes(AccountMenu({ visitor }));
 assert.deepEqual(all.filter(n => n.props?.href).map(n => n.props.href), visitor === "guest" ? ["/register", "/login"] : ["/login", "/register"]);
 assert.ok(!all.some(n => n.type === "form"));
 assert.equal(all.find(n => n.type === "summary").props["aria-label"], "Account navigation");
});
test("theme action icons have hidden SVGs and accessible labels without client handlers", () => {
 const tree = ThemeToggle(); const all = nodes(tree);
 assert.match(tree.props.className, /min-h-11 min-w-11/);
 assert.equal(all.filter(n => n.type === "svg" && n.props["aria-hidden"] === "true").length, 2);
 assert.deepEqual(all.filter(n => n.props?.className === "sr-only").map(n => n.props.children), ["Switch to dark mode", "Switch to light mode"]);
 assert.equal(tree.props.onClick, undefined);
});
