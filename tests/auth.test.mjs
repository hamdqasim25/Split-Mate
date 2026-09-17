import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { registerHooks } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import bcrypt from "bcryptjs";
import { resetAuthEnvironment, state } from "./helpers/auth-environment.mjs";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "@/prisma/db" || specifier === "next/headers") {
      return { url: new URL("./helpers/auth-environment.mjs", import.meta.url).href, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const { registerUser, authenticateUser, BCRYPT_COST } = await import("../src/data/auth.ts");
const { createUserSession, getCurrentUser, requireUser, revokeUserSession } = await import("../src/lib/auth/session.ts");
const registerRoute = await import("../src/app/api/auth/register/route.ts");
const loginRoute = await import("../src/app/api/auth/login/route.ts");
const logoutRoute = await import("../src/app/api/auth/logout/route.ts");
hooks.deregister();

const previousNodeEnv = process.env.NODE_ENV;
const password = "a strong owner password";
const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
const secureCookie = "__Host-splitmate_owner_session";
const localCookie = "splitmate_owner_session";

beforeEach(() => {
  resetAuthEnvironment();
  process.env.NODE_ENV = "development";
});
afterEach(() => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

function addUser() {
  state.users.push({ id: 7, name: "Hamdi", email: "owner@example.com", passwordHash });
}

function addSession({ expiry = new Date(Date.now() + 60_000).toISOString(), userId = 7, name = localCookie } = {}) {
  const token = randomBytes(32).toString("base64url");
  state.sessions.push({ id: state.sessions.length + 1, userId, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: expiry });
  state.cookieJar.set(name, token);
  return token;
}

function request(route, body, options = {}) {
  return new Request(`http://localhost:3000/api/auth/${route}`, {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", ...options.headers },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

test("registers a normalized email and hashes an unchanged password at cost 12", async () => {
  const rawPassword = "  a strong password with spaces  ";
  const user = await registerUser({ name: " Hamdi   Qasim ", email: " OWNER@Example.COM ", password: rawPassword });
  assert.deepEqual(user, { id: 1, name: "Hamdi Qasim" });
  const stored = state.users[0];
  assert.equal(stored.email, "owner@example.com");
  assert.equal(BCRYPT_COST, 12);
  assert.equal(bcrypt.getRounds(stored.passwordHash), 12);
  assert.notEqual(stored.passwordHash, rawPassword);
  assert.equal(await bcrypt.compare(rawPassword, stored.passwordHash), true);
  assert.equal(await bcrypt.compare(rawPassword.trim(), stored.passwordHash), false);
  assert.equal(state.sessions.length, 0);
});

test("accepts exactly 72 UTF-8 bytes and rejects 73 or a multibyte overflow", async () => {
  const exact = "é".repeat(36);
  assert.equal(Buffer.byteLength(exact, "utf8"), 72);
  await registerUser({ name: "Owner", email: "owner@example.com", password: exact });
  for (const value of ["a".repeat(73), "é".repeat(37), "😀".repeat(19)]) {
    await assert.rejects(registerUser({ name: "Owner", email: "other@example.com", password: value }), { code: "INVALID_INPUT", field: "password" });
  }
  assert.equal(state.users.length, 1);
});

const invalidRegistrations = [
  ["non-object", null],
  ["array", []],
  ["blank name", { name: " " }],
  ["long name", { name: "a".repeat(101) }],
  ["invalid email", { email: "not-an-email" }],
  ["long email", { email: `${"a".repeat(250)}@example.com` }],
  ["short password", { password: "short" }],
  ["non-string password", { password: 123 }],
  ["client-chosen ID", { id: 99 }],
];
for (const [label, fields] of invalidRegistrations) {
  test(`rejects registration with ${label}`, async () => {
    const input = fields === null || Array.isArray(fields) ? fields : { name: "Owner", email: "owner@example.com", password, ...fields };
    await assert.rejects(registerUser(input), { code: "INVALID_INPUT" });
    assert.equal(state.users.length, 0);
    assert.equal(state.reads, 0);
  });
}

test("handles normalized duplicate emails and concurrent registration conflicts", async () => {
  addUser();
  await assert.rejects(registerUser({ name: "Other", email: " OWNER@EXAMPLE.COM ", password }), { code: "REGISTRATION_CONFLICT" });
  assert.equal(state.users.length, 1);
  resetAuthEnvironment();
  state.insertConflict = true;
  await assert.rejects(registerUser({ name: "Other", email: "owner@example.com", password }), { code: "REGISTRATION_CONFLICT" });
  assert.equal(state.users.length, 1);
});

test("login normalizes email and returns only the safe User identity", async () => {
  addUser();
  assert.deepEqual(await authenticateUser({ email: " OWNER@Example.COM ", password }), { id: 7, name: "Hamdi" });
});

test("wrong password, unknown email and invalid credential values share one login error", async () => {
  addUser();
  const attempts = [
    { email: "owner@example.com", password: "wrong password" },
    { email: "unknown@example.com", password },
    { email: "owner@example.com", password: "é".repeat(37) },
    { email: "invalid", password },
    { email: "owner@example.com", password: null },
    { email: "owner@example.com", password, userId: 7 },
    null,
  ];
  for (const attempt of attempts) {
    await assert.rejects(authenticateUser(attempt), { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." });
  }
  assert.equal(state.sessions.length, 0);
});

test("session issuance stores only a SHA-256 hash and sets a host-only HTTP development cookie", async () => {
  addUser();
  const before = Date.now();
  await createUserSession(7, "http://localhost:3000/api/auth/login");
  const [cookie] = state.cookieWrites;
  const [session] = state.sessions;
  assert.equal(cookie.name, localCookie);
  assert.match(cookie.value, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(cookie.value, "base64url").length, 32);
  assert.equal(session.tokenHash, createHash("sha256").update(cookie.value).digest("hex"));
  assert.equal(JSON.stringify(session).includes(cookie.value), false);
  assert.equal(session.userId, 7);
  assert.ok(Date.parse(session.expiresAt) >= before + 8 * 60 * 60 * 1000);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, false);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/");
  assert.equal(cookie.options.maxAge, 8 * 60 * 60);
  assert.equal(cookie.options.expires.toISOString(), session.expiresAt);
  assert.equal("domain" in cookie.options, false);
  assert.ok(state.events.indexOf("db:commit") < state.events.indexOf("cookie:set"));
  assert.deepEqual(await getCurrentUser(), { id: 7, name: "Hamdi" });
  assert.deepEqual(await requireUser(), { id: 7, name: "Hamdi" });
});

test("HTTPS development and production always issue the secure __Host cookie", async () => {
  addUser();
  await createUserSession(7, "https://localhost:3000/api/auth/login");
  assert.equal(state.cookieWrites[0].name, secureCookie);
  assert.equal(state.cookieWrites[0].options.secure, true);
  assert.deepEqual(await getCurrentUser(), { id: 7, name: "Hamdi" });
  resetAuthEnvironment();
  addUser();
  process.env.NODE_ENV = "production";
  await createUserSession(7, "http://internal-proxy/api/auth/login");
  assert.equal(state.cookieWrites[0].name, secureCookie);
  assert.equal(state.cookieWrites[0].options.secure, true);
  assert.equal("domain" in state.cookieWrites[0].options, false);
});

test("login rotates the current token and revokes its previous database session", async () => {
  addUser();
  const oldToken = addSession();
  await createUserSession(7, "http://localhost:3000/api/auth/login");
  assert.equal(state.sessions.length, 1);
  assert.notEqual(state.cookieJar.get(localCookie), oldToken);
  const newToken = state.cookieJar.get(localCookie);
  state.cookieJar.set(localCookie, oldToken);
  assert.equal(await getCurrentUser(), null);
  state.cookieJar.set(localCookie, newToken);
  assert.deepEqual(await getCurrentUser(), { id: 7, name: "Hamdi" });
});

test("failed session creation rolls back old-session revocation and issues no cookie", async () => {
  addUser();
  const oldToken = addSession();
  state.failAt = "sessions.create";
  await assert.rejects(createUserSession(7, "http://localhost:3000/api/auth/login"), (error) => error === state.failure);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.cookieJar.get(localCookie), oldToken);
  assert.equal(state.cookieWrites.length, 0);
  assert.ok(state.events.includes("db:rollback"));
});

test("malformed or missing tokens fail before database access", async () => {
  const canonical = Buffer.alloc(32).toString("base64url");
  for (const value of [undefined, "", "7", "../token", "a".repeat(5000), `${canonical}=`, canonical.slice(0, -1) + "B"]) {
    state.cookieJar.clear();
    if (value !== undefined) state.cookieJar.set(localCookie, value);
    assert.equal(await getCurrentUser(), null);
  }
  assert.equal(state.reads, 0);
  await assert.rejects(requireUser(), { code: "UNAUTHENTICATED" });
});

test("expired, malformed-expiry, revoked and missing-user sessions are rejected", async () => {
  for (const expiry of [new Date(Date.now() - 1).toISOString(), "not-a-date"]) {
    resetAuthEnvironment();
    addUser();
    addSession({ expiry });
    assert.equal(await getCurrentUser(), null);
  }
  resetAuthEnvironment();
  addUser();
  addSession();
  state.sessions = [];
  assert.equal(await getCurrentUser(), null);
  resetAuthEnvironment();
  addSession();
  assert.equal(await getCurrentUser(), null);
});

test("owner authentication ignores guest cookies and production ignores the HTTP cookie", async () => {
  addUser();
  state.cookieJar.set("splitmate_guest_session", randomBytes(32).toString("base64url"));
  assert.equal(await getCurrentUser(), null);
  addSession();
  process.env.NODE_ENV = "production";
  assert.equal(await getCurrentUser(), null);
  assert.equal(state.reads, 0);
});

test("a malformed HTTPS cookie does not fall back to another owner cookie", async () => {
  addUser();
  addSession();
  state.cookieJar.set(secureCookie, "invalid");
  assert.equal(await getCurrentUser(), null);
  assert.equal(state.reads, 0);
});

test("logout revokes the database token before expiring cookies and leaves guest cookies alone", async () => {
  addUser();
  const oldToken = addSession();
  state.cookieJar.set("splitmate_guest_session", "guest-value");
  await revokeUserSession();
  assert.equal(state.sessions.length, 0);
  assert.ok(state.events.indexOf("db:commit") < state.events.indexOf("cookie:set"));
  assert.equal(state.cookieJar.has(localCookie), false);
  assert.equal(state.cookieJar.get("splitmate_guest_session"), "guest-value");
  for (const cookie of state.cookieWrites) {
    assert.equal(cookie.options.maxAge, 0);
    assert.equal(cookie.options.expires.getTime(), 0);
    assert.equal("domain" in cookie.options, false);
  }
  state.cookieJar.set(localCookie, oldToken);
  assert.equal(await getCurrentUser(), null);
});

test("failed database revocation preserves the browser cookie and reports an error", async () => {
  addUser();
  const token = addSession();
  state.failAt = "sessions.delete";
  await assert.rejects(revokeUserSession(), (error) => error === state.failure);
  assert.equal(state.cookieJar.get(localCookie), token);
  assert.equal(state.cookieWrites.length, 0);
  assert.equal(state.sessions.length, 1);
});

test("route handlers expose POST only", () => {
  for (const route of [registerRoute, loginRoute, logoutRoute]) {
    assert.deepEqual(Object.keys(route).sort(), ["POST", "runtime"]);
    assert.equal(route.runtime, "nodejs");
  }
});

test("register, login, authenticated lookup and logout work together through the handlers", async () => {
  const register = await registerRoute.POST(request("register", { name: "Owner", email: " Owner@Example.com ", password }));
  assert.equal(register.status, 201);
  assert.deepEqual(await register.json(), { user: { id: 1, name: "Owner" } });
  assert.equal(state.cookieWrites.length, 0);
  const login = await loginRoute.POST(request("login", { email: " OWNER@EXAMPLE.COM ", password }));
  assert.equal(login.status, 200);
  assert.equal(login.headers.get("cache-control"), "no-store");
  assert.deepEqual(await login.json(), { user: { id: 1, name: "Owner" } });
  assert.deepEqual(await requireUser(), { id: 1, name: "Owner" });
  const logout = await logoutRoute.POST(request("logout"));
  assert.equal(logout.status, 204);
  assert.equal(await logout.text(), "");
  assert.equal(await getCurrentUser(), null);
});

test("credential failures return generic 401 responses and never issue cookies", async () => {
  addUser();
  const bodies = [];
  for (const credentials of [{ email: "owner@example.com", password: "wrong" }, { email: "unknown@example.com", password }]) {
    const response = await loginRoute.POST(request("login", credentials));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    bodies.push(await response.json());
  }
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(state.cookieWrites.length, 0);
});

test("all auth mutations reject cross-origin, missing-Origin and null-Origin requests before database access", async () => {
  for (const route of [registerRoute, loginRoute, logoutRoute]) {
    for (const origin of ["https://attacker.example", "null", undefined]) {
      const req = request("login", { email: "owner@example.com", password });
      if (origin === undefined) req.headers.delete("origin");
      else req.headers.set("origin", origin);
      const response = await route.POST(req);
      assert.equal(response.status, 403);
    }
  }
  assert.equal(state.reads, 0);
  assert.equal(state.transactions, 0);
  assert.equal(state.cookieWrites.length, 0);
});

test("forwarded host headers cannot bypass origin checks", async () => {
  const response = await loginRoute.POST(request("login", {}, { headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example" } }));
  assert.equal(response.status, 403);
});

test("auth endpoints enforce JSON, reject malformed JSON and bound actual body bytes", async () => {
  const text = await registerRoute.POST(request("register", {}, { headers: { "content-type": "text/plain" } }));
  assert.equal(text.status, 415);
  const malformed = new Request("http://localhost:3000/api/auth/login", {
    method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "{broken",
  });
  assert.equal((await loginRoute.POST(malformed)).status, 400);
  const oversized = request("register", { name: "é".repeat(3000) }, { headers: { "content-length": "1" } });
  assert.equal((await registerRoute.POST(oversized)).status, 413);
  assert.equal(state.reads, 0);
});

test("unexpected database failures return safe 500 responses without logging private details", async (context) => {
  const log = context.mock.method(console, "error", () => {});
  state.failAt = "users.first";
  const response = await loginRoute.POST(request("login", { email: "owner@example.com", password }));
  assert.equal(response.status, 500);
  const body = await response.text();
  assert.equal(body.includes("PRIVATE_DATABASE_ERROR_DETAIL"), false);
  assert.equal(JSON.stringify(log.mock.calls).includes("PRIVATE_DATABASE_ERROR_DETAIL"), false);
  assert.equal(state.cookieWrites.length, 0);
  assert.equal(log.mock.callCount(), 1);
});

test("logout reports database revocation failure without expiring the cookie", async (context) => {
  context.mock.method(console, "error", () => {});
  addUser();
  const token = addSession();
  state.failAt = "sessions.delete";
  const response = await logoutRoute.POST(request("logout"));
  assert.equal(response.status, 500);
  assert.equal(state.cookieJar.get(localCookie), token);
  assert.equal(state.cookieWrites.length, 0);
});
