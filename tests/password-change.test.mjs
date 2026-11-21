import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { beforeEach, afterEach, test } from "node:test";
import bcrypt from "bcryptjs";
import { state, resetAuthEnvironment } from "./helpers/auth-environment.mjs";
const hooks = registerHooks({ resolve(specifier, context, next) {
 if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
 if (["@/prisma/db", "next/headers"].includes(specifier)) return { url: new URL("./helpers/auth-environment.mjs", import.meta.url).href, shortCircuit: true };
 if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
 return next(specifier, context);
}});
const { POST } = await import("../src/app/api/auth/change-password/route.ts");
const { authenticateUser } = await import("../src/data/auth.ts");
const { createUserSession, getCurrentUser } = await import("../src/lib/auth/session.ts");
hooks.deregister();
const old = "original secure password";
const next = "replacement secure password";
const hash = await bcrypt.hash(old, 12);
const payload = { currentPassword: old, newPassword: next, confirmPassword: next };
const previousEnv = process.env.NODE_ENV;
function session(id, cookie = false) {
 const token = randomBytes(32).toString("base64url");
 state.sessions.push({ id: state.sessions.length + 1, userId: id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now()+60000).toISOString() });
 if (cookie) state.cookieJar.set("splitmate_owner_session", token);
 return token;
}
beforeEach(() => { resetAuthEnvironment(); process.env.NODE_ENV = "development"; state.users.push({ id: 7, name: "Owner", email: "owner@example.com", passwordHash: hash }, { id: 8, name: "Other", email: "other@example.com", passwordHash: hash }); session(7, true); session(7); session(8); state.cookieJar.set("splitmate_guest_session", "guest-credential-untouched"); });
afterEach(() => { if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv; });
function request(body = payload, headers = {}) { return new Request("http://localhost:3000/api/auth/change-password", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }
test("password change atomically revokes all own sessions, preserves others, clears own cookies and allows only new credentials", async () => {
 const others = structuredClone(state.sessions.filter(s => s.userId === 8));
 const response = await POST(request()); assert.equal(response.status, 200);
 assert.equal(state.sessions.filter(s => s.userId === 7).length, 0);
 assert.deepEqual(state.sessions, others); assert.equal(await getCurrentUser(), null);
 assert.equal(state.cookieJar.get("splitmate_guest_session"), "guest-credential-untouched");
 assert.equal(bcrypt.getRounds(state.users[0].passwordHash), 12);
 assert.deepEqual(await authenticateUser({ email: "owner@example.com", password: next }), { id: 7, name: "Owner" });
 await assert.rejects(authenticateUser({ email: "owner@example.com", password: old }), { code: "INVALID_CREDENTIALS" });
 const body = await response.text(); assert.doesNotMatch(body, /passwordHash|tokenHash|postgres/);
 assert.equal((await POST(request())).status, 401);
});
for (const [label, patch] of [["wrong current", { currentPassword: "wrong" }], ["short", { newPassword: "short" }], ["byte overflow", { newPassword: "x".repeat(73) }], ["multibyte overflow", { newPassword: "\u00e9".repeat(37) }], ["mismatch", { confirmPassword: "mismatch" }], ["foreign ID", { userId: 8 }], ["missing current", { currentPassword: null }]]) test(`rejects ${label} without changing credentials or sessions`, async () => {
 const before = structuredClone({ users: state.users, sessions: state.sessions });
 assert.equal((await POST(request({ ...payload, ...patch }))).status, 400);
 assert.deepEqual({ users: state.users, sessions: state.sessions }, before); assert.equal(state.cookieWrites.length, 0);
});
for (const kind of ["anonymous", "guest-only", "expired", "revoked", "deleted"]) test(`rejects ${kind} identity`, async () => {
 if (["anonymous", "guest-only"].includes(kind)) state.cookieJar.delete("splitmate_owner_session");
 if (kind === "expired") state.sessions[0].expiresAt = new Date(0).toISOString();
 if (kind === "revoked") state.sessions.shift();
 if (kind === "deleted") state.users.shift();
 assert.equal((await POST(request())).status, 401);
});
test("same-origin and bounded JSON checks reject unsafe requests before writes", async () => {
 for (const headers of [{ origin: "https://evil.example" }, { origin: "null" }, { origin: "" }, { "sec-fetch-site": "cross-site" }]) assert.equal((await POST(request(payload, headers))).status, 403);
 assert.equal((await POST(request({ padding: "x".repeat(5000) }))).status, 413);
 assert.equal((await POST(request(payload, { "content-type": "text/plain" }))).status, 415);
 const malformed = new Request("http://localhost:3000/api/auth/change-password", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "{" });
 assert.equal((await POST(malformed)).status, 400); assert.equal(state.transactions, 0);
});
test("failure during revocation rolls password back and preserves cookies with safe response", async () => {
 state.failAt = "sessions.delete";
 const before = structuredClone({ users: state.users, sessions: state.sessions });
 const response = await POST(request()); assert.equal(response.status, 500);
 assert.deepEqual({ users: state.users, sessions: state.sessions }, before);
 assert.equal(state.cookieWrites.length, 0); assert.doesNotMatch(await response.text(), /PRIVATE|postgres|passwordHash/);
});
test("stale verified login hash cannot issue a session after password update", async () => {
 state.users[0].passwordHash = await bcrypt.hash(next, 12);
 const before = structuredClone(state.sessions);
 await assert.rejects(createUserSession(7, "http://localhost:3000", hash), { code: "INVALID_CREDENTIALS" });
 assert.deepEqual(state.sessions, before); assert.equal(state.cookieWrites.length, 0);
});
test("72-byte password retains leading/trailing spaces", async () => {
 const password = " " + "x".repeat(70) + " ";
 assert.equal((await POST(request({ ...payload, newPassword: password, confirmPassword: password }))).status, 200);
 assert.ok(await bcrypt.compare(password, state.users[0].passwordHash));
});
