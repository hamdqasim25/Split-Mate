import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import ts from "typescript";

// In-memory React hooks let us exercise the actual submit handler without a DOM
// dependency. Page session reads and navigation never reach Next.js or a database.
const runtimeUrl = `data:text/javascript,${encodeURIComponent(`
  export const state = { user: null, slots: [], cursor: 0, dashboard: null, ownerReads: [] };
  export async function getCurrentUser() { return state.user; }
  export async function getGroupsForOwner(ownerId) {
    state.ownerReads.push(ownerId);
    return state.dashboard;
  }
  export function redirect(destination) { throw Object.assign(new Error('redirect'), { destination }); }
  // The protected group page imports its client form, but these tests do not render it.
  export function useRouter() { throw new Error('Unexpected client router use in page tests'); }
  export function useState(initial) {
    const index = state.cursor++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], value => { state.slots[index] = value; }];
  }
  export function useRef(initial) {
    const index = state.cursor++;
    return state.slots[index] ??= { current: initial };
  }
  export default function Link() {}
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (["@/lib/auth/session", "@/data/groups", "next/navigation", "next/link"].includes(specifier)
      || (specifier === "react" && context.parentURL?.endsWith("/auth-form.tsx"))) {
      return { url: runtimeUrl, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return { url: new URL(`../src/${specifier.slice(2)}.tsx`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) {
      const source = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      return { format: "module", source, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
const { state } = await import(runtimeUrl);
const { default: Dashboard } = await import("../src/app/dashboard/page.tsx");
const { default: NewGroup } = await import("../src/app/groups/new/page.tsx");
const { default: Login } = await import("../src/app/login/page.tsx");
const { default: Register } = await import("../src/app/register/page.tsx");
const { default: Home } = await import("../src/app/page.tsx");
const { default: AuthForm } = await import("../src/components/auth/auth-form.tsx");
hooks.deregister();

const originalFetch = globalThis.fetch;
const originalFormData = globalThis.FormData;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
let requests;
let navigations;
beforeEach(() => {
  state.user = null;
  state.slots = [];
  state.cursor = 0;
  state.ownerReads = [];
  state.dashboard = {
    groups: [{
      id: 42, name: "Mocked climbing group", description: "Thursday climbing sessions",
      currency: "GBP", members: 4, createdAt: "2026-09-19T10:00:00Z",
    }],
    activity: [{
      id: 81, groupId: 42, description: "Private owner created the group",
      createdAt: "2026-09-19T10:00:00Z",
    }],
  };
  requests = [];
  navigations = [];
  globalThis.FormData = class { constructor(form) { this.form = form; } get(key) { return this.form[key] ?? null; } };
  globalThis.window = { location: { assign: destination => navigations.push(destination) } };
  globalThis.fetch = async (url, options) => {
    requests.push({ url, ...options });
    return { ok: true, status: 200 };
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.FormData = originalFormData;
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else delete globalThis.window;
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (tree === null || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function render(props = {}) {
  state.cursor = 0;
  return AuthForm({ mode: "login", destination: "/dashboard", ...props });
}
function submit(tree, fields = {}) {
  return nodes(tree).find(node => node.type === "form").props.onSubmit({
    preventDefault() {},
    currentTarget: { email: " OWNER@Example.com ", password: "a strong owner password", name: " Owner ", ...fields },
  });
}
const params = next => ({ searchParams: Promise.resolve({ next }) });

for (const [path, Page] of [["/dashboard", Dashboard], ["/groups/new", NewGroup]]) {
  test(`anonymous ${path} redirects before rendering`, async () => {
    await assert.rejects(Page(), { destination: `/login?next=${path}` });
    assert.deepEqual(state.ownerReads, [], "Group data must not load before authentication");
  });
  test(`authenticated ${path} renders existing content`, async () => {
    state.user = { id: 7, name: "Private owner" };
    const tree = await Page();
    assert.equal(tree.type, "main");
    if (path === "/groups/new") {
      assert.match(text(tree), /Create a group/);
      return;
    }

    assert.deepEqual(state.ownerReads, [7], "Use the verified session's owner ID");
    assert.match(text(tree), /Welcome back, Private owner/);
    const sections = nodes(tree).filter(node => node.type === "section");
    const groupsSection = sections.find(section => text(section).includes("Your groups"));
    assert.match(text(groupsSection), /Mocked climbing group/);
    assert.match(text(groupsSection), /Thursday climbing sessions/);
    assert.match(text(groupsSection), /4 members · GBP/);

    const activitySection = sections.find(section => text(section).includes("Recent activity"));
    assert.match(text(activitySection), /Private owner created the group/);
    assert.match(text(activitySection), /Mocked climbing group/);

    for (const label of ["You are owed", "You owe"]) {
      const card = nodes(tree).find(node => node.type === "div"
        && Array.isArray(node.props.children)
        && node.props.children.some(child => child?.type === "p" && text(child) === label));
      assert.ok(card, `${label} card renders`);
      const paragraphs = nodes(card).filter(node => node.type === "p").map(text);
      assert.ok(paragraphs.includes("—"));
      assert.ok(paragraphs.includes("Available once expenses are added"));
    }
    assert.doesNotMatch(text(tree), /£40\.00|£12\.00|£75\.00|£45\.00|Weekend Trip|Football|Dinner together|Train tickets/);
  });
}

const destinations = [
  ["/dashboard", "/dashboard"], ["/groups/new", "/groups/new"],
  ["https://evil.example", "/dashboard"], ["//evil.example", "/dashboard"],
  ["/admin", "/dashboard"], ["/groups/new?bad=1", "/dashboard"],
  ["%2Fgroups%2Fnew", "/dashboard"], [" /groups/new", "/dashboard"],
  [["/groups/new", "/dashboard"], "/dashboard"], [undefined, "/dashboard"],
];
for (const Page of [Login, Register]) {
  for (const [next, expected] of destinations) {
    test(`${Page.name} safely handles next=${JSON.stringify(next)}`, async () => {
      const tree = await Page(params(next));
      assert.equal(tree.props.destination, expected);
      state.user = { id: 7, name: "Private owner" };
      await assert.rejects(Page(params(next)), { destination: expected });
    });
  }
}

test("registration confirmation accepts only the harmless exact flag", async () => {
  assert.equal((await Login({ searchParams: Promise.resolve({ registered: "1" }) })).props.accountCreated, true);
  assert.equal((await Login({ searchParams: Promise.resolve({ registered: ["1"] }) })).props.accountCreated, false);
  assert.match(text(render({ accountCreated: true })), /Account created/);
});

for (const destination of ["/dashboard", "/groups/new"]) {
  test(`login makes a fresh navigation to ${destination}`, async () => {
    await submit(render({ destination }));
    assert.deepEqual(navigations, [destination]);
    assert.equal(requests[0].url, "/api/auth/login");
    assert.equal(requests[0].method, "POST");
    assert.equal(requests[0].credentials, "same-origin");
    assert.deepEqual(JSON.parse(requests[0].body), { email: "owner@example.com", password: "a strong owner password" });
  });
}
test("registration only registers and navigates to login with safe context", async () => {
  await submit(render({ mode: "register", destination: "/groups/new" }));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/auth/register");
  assert.equal(JSON.parse(requests[0].body).name, "Owner");
  assert.deepEqual(navigations, ["/login?registered=1&next=%2Fgroups%2Fnew"]);
});
test("the client also rejects a malformed destination", async () => {
  await submit(render({ destination: "//evil.example" }));
  assert.deepEqual(navigations, ["/dashboard"]);
});
test("invalid credentials stay generic and allow retry", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "private internals" } }) });
  await submit(render());
  const tree = render();
  assert.equal(text(nodes(tree).find(node => node.props.role === "alert")), "Email or password is incorrect.");
  assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, false);
  assert.deepEqual(navigations, []);
});
test("network failures show a safe error and allow retry", async () => {
  globalThis.fetch = async () => { throw new Error("private network details"); };
  await submit(render());
  assert.match(text(render()), /Unable to connect/);
  assert.doesNotMatch(text(render()), /private network/);
  assert.deepEqual(navigations, []);
});
test("pending state blocks duplicate submissions before and after a render", async () => {
  let finish;
  let calls = 0;
  globalThis.fetch = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const tree = render();
  const pending = submit(tree);
  await submit(tree);
  assert.equal(nodes(render()).find(node => node.type === "fieldset").props.disabled, true);
  await submit(render());
  assert.equal(calls, 1);
  finish({ ok: true, status: 200 });
  await pending;
  assert.deepEqual(navigations, ["/dashboard"]);
});
for (const password of ["short", "😀".repeat(14), "é".repeat(37)]) {
  test(`registration rejects password with ${[...password].length} characters / ${Buffer.byteLength(password)} bytes`, async () => {
    await submit(render({ mode: "register" }), { password });
    assert.equal(requests.length, 0);
    assert.match(text(render({ mode: "register" })), /at least 15 characters/);
    assert.equal(nodes(render()).some(node => node.props.role === "alert"), true);
  });
}
test("registration accepts the 72-byte boundary without trimming passwords", async () => {
  const password = " " + "é".repeat(35) + " ";
  await submit(render({ mode: "register" }), { password });
  assert.equal(JSON.parse(requests[0].body).password, password);
});
test("forms provide labels, autocomplete and a POST fallback", () => {
  for (const mode of ["login", "register"]) {
    const all = nodes(render({ mode }));
    for (const input of all.filter(node => node.type === "input")) {
      assert.ok(all.some(node => node.type === "label" && node.props.htmlFor === input.props.id));
      assert.ok(input.props.autoComplete);
    }
    assert.equal(all.find(node => node.props.id === "password").props.autoComplete, mode === "login" ? "current-password" : "new-password");
    assert.equal(all.find(node => node.type === "form").props.method, "post");
  }
});
test("landing actions reflect server-side authentication without exposing identity", async () => {
  const anonymous = await Home();
  assert.ok(nodes(anonymous).some(node => node.props.href === "/login" && text(node) === "Log in"));
  assert.ok(nodes(anonymous).some(node => node.props.href === "/register" && text(node).startsWith("Get started")));
  assert.match(text(anonymous), /Create account/);
  state.user = { id: 7, name: "Private owner" };
  const authenticated = await Home();
  assert.equal(nodes(authenticated).filter(node => node.props.href === "/dashboard").length, 2);
  assert.doesNotMatch(text(authenticated), /Private owner|Log in|Create account/);
});
