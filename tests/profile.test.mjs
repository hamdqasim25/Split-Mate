import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, afterEach, test } from "node:test";
import ts from "typescript";
import { resetAuthEnvironment, state, db } from "./helpers/auth-environment.mjs";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/components/account-menu") return { url: "data:text/javascript,export default function AccountMenu(){}", shortCircuit: true };
    if (specifier === "@/components/theme-toggle") return { url: new URL("../src/components/theme-toggle.tsx", import.meta.url).href, shortCircuit: true };
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (["@/prisma/db", "next/headers"].includes(specifier)) return { url: new URL("./helpers/auth-environment.mjs", import.meta.url).href, shortCircuit: true };
    if (specifier === "next/navigation") return { url: "data:text/javascript,export function redirect(destination){throw Object.assign(new Error('redirect'),{destination})}", shortCircuit: true };
    if (specifier === "next/link") return { url: "data:text/javascript,export default function Link(){}", shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText };
    return nextLoad(url, context);
  },
});
const { getCurrentAccount } = await import("../src/data/account.ts");
const { default: Profile } = await import("../src/app/profile/page.tsx");
const { default: Appearance } = await import("../src/app/profile/appearance/page.tsx");
hooks.deregister();
const originalEnv = process.env.NODE_ENV;
beforeEach(() => {
  resetAuthEnvironment();
  process.env.NODE_ENV = "development";
  state.users.push({ id: 7, name: "Owner Seven", email: "seven@example.com", passwordHash: "PRIVATE_HASH" }, { id: 8, name: "Owner Eight", email: "eight@example.com", passwordHash: "OTHER_HASH" });
});
afterEach(() => { if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv; });
function session(userId = 7, expiresAt = new Date(Date.now() + 60000).toISOString()) {
  const token = randomBytes(32).toString("base64url");
  state.cookieJar.set("splitmate_owner_session", token);
  state.sessions.push({ userId, expiresAt, tokenHash: createHash("sha256").update(token).digest("hex") });
  return token;
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
for (const kind of ["anonymous", "expired", "revoked", "guest-only", "deleted-account"]) {
  test(`profile rejects ${kind} access`, async () => {
    if (kind === "expired") session(7, new Date(0).toISOString());
    if (kind === "revoked") { session(); state.sessions = []; }
    if (kind === "guest-only") state.cookieJar.set("splitmate_guest_session", randomBytes(32).toString("base64url"));
    if (kind === "deleted-account") { session(); state.users = []; }
    assert.equal(await getCurrentAccount(), null);
    await assert.rejects(Profile(), { destination: "/login?next=/profile" });
    await assert.rejects(Appearance(), { destination: "/login?next=/profile/appearance" });
  });
}
test("profile reads each authenticated owner only and exposes no credentials", async () => {
  for (const id of [7, 8]) {
    const token = session(id);
    const user = state.users.find(user => user.id === id);
    assert.deepEqual(await getCurrentAccount(), { name: user.name, email: user.email });
    const tree = await Profile();
    const rendered = JSON.stringify(tree);
    assert.ok(rendered.includes(user.email));
    assert.ok(rendered.includes(user.name));
    assert.ok(!rendered.includes(state.users.find(user => user.id !== id).email));
    assert.ok(!rendered.includes(token));
    assert.doesNotMatch(rendered, /PRIVATE_HASH|OTHER_HASH|passwordHash|tokenHash/);
    assert.equal(nodes(tree).filter(node => node.type === "dl").length, 1);
    assert.equal(nodes(tree).filter(node => node.type === "input").length, 0);
    assert.ok(nodes(tree).some(node => node.props?.href === "/dashboard"));
    assert.equal(nodes(tree).filter(node => node.type === "form").length, 0);
    assert.ok(!nodes(tree).some(node => node.type?.name === "AccountMenu"));
  }
});
test("account disappearing between identity and profile reads is unavailable", async () => {
  session();
  const select = db.orm.public.User.select;
  db.orm.public.User.select = function (...fields) {
    if (fields.includes("email")) state.users = [];
    return select.apply(this, fields);
  };
  try { await assert.rejects(Profile(), { destination: "/login?next=/profile" }); }
  finally { db.orm.public.User.select = select; }
});
test("database failures are not treated as anonymous access", async () => {
  session(); state.failAt = "users.first";
  await assert.rejects(getCurrentAccount(), state.failure);
});

test("appearance is protected and reuses theme control without account details", async () => {
  session();
  const tree = await Appearance();
  assert.ok(!nodes(tree).some(node => node.type?.name === "AccountMenu"));
  assert.ok(nodes(tree).some(node => node.type?.name === "ThemeToggle"));
  assert.doesNotMatch(JSON.stringify(tree), /seven@example|passwordHash/);
});
