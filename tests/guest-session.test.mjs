import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { claimMember } = await import("../src/data/invites.ts");
const { getGuestForGroup, setGuestSessionCookie, revokeGuestSession } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
const originalEnv = process.env.NODE_ENV;
beforeEach(() => { reset(); process.env.NODE_ENV = "development"; });
afterEach(() => { if (originalEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnv; });
async function join() { const session = await claimMember(token, 2); await setGuestSessionCookie(session); return session; }
test("guest cookie is HttpOnly, host-only and aligned with database expiry", async () => {
  const session = await join();
  assert.deepEqual(state.cookieWrites[0], {
    name: "splitmate_guest_session", value: session.token,
    options: { httpOnly: true, secure: false, sameSite: "lax", path: "/", expires: session.expiresAt },
  });
  assert.deepEqual(await getGuestForGroup(1), { id: 2, name: "Jaher" });
  assert.equal(await getGuestForGroup(99), null);
});
test("production uses secure __Host cookie and ignores local cookie", async () => {
  await join(); process.env.NODE_ENV = "production";
  assert.equal(await getGuestForGroup(1), null);
  await setGuestSessionCookie({ token: state.cookies.get("splitmate_guest_session"), expiresAt: new Date(Date.now() + 1000) });
  assert.equal(state.cookieWrites.at(-1).name, "__Host-splitmate_guest_session");
  assert.equal(state.cookieWrites.at(-1).options.secure, true);
  assert.ok(await getGuestForGroup(1));
});
for (const expiry of ["2000-01-01T00:00:00Z", "invalid"]) test(`rejects expiry ${expiry}`, async () => {
  await join(); state.rows.GuestSession[0].expiresAt = expiry;
  assert.equal(await getGuestForGroup(1), null);
});
for (const change of [{ isActive: false }, { claimedAt: null }, { userId: 7 }, { role: "OWNER" }]) test(`rejects changed eligibility ${JSON.stringify(change)}`, async () => {
  await join(); Object.assign(state.rows.GroupMember[0], change);
  assert.equal(await getGuestForGroup(1), null);
});
test("malformed secure cookie cannot fall back to local cookie", async () => {
  await join(); state.cookies.set("__Host-splitmate_guest_session", "bad");
  assert.equal(await getGuestForGroup(1), null);
});
test("missing, unknown and owner cookies do not establish guest identity", async () => {
  assert.equal(await getGuestForGroup(1), null);
  state.cookies.set("splitmate_owner_session", token);
  assert.equal(await getGuestForGroup(1), null);
  state.cookies.set("splitmate_guest_session", token);
  assert.equal(await getGuestForGroup(1), null);
});

for (const model of ["GuestSession", "GroupMember", "Group"]) test(`rejects missing ${model}`, async () => {
  await join(); state.rows[model] = [];
  assert.equal(await getGuestForGroup(1), null);
});
test("session pointing to missing member cannot authenticate", async () => {
  await join(); state.rows.GuestSession[0].groupMemberId = 999;
  assert.equal(await getGuestForGroup(1), null);
});
test("invalid group IDs and read-only session lookups cause no writes", async () => {
  await join(); state.writes = [];
  for (const id of [undefined, null, "1", 0, -1, 1.5, 2147483648]) assert.equal(await getGuestForGroup(id), null);
  assert.ok(await getGuestForGroup(1));
  assert.deepEqual(state.writes, []);
});
test("guest sign-out revokes current session, preserving claims and unrelated sessions", async () => {
  const session = await join();
  const member = structuredClone(state.rows.GroupMember[0]);
  state.rows.GuestSession.push({ ...state.rows.GuestSession[0], id: 99, tokenHash: "unrelated" });
  state.cookies.set("splitmate_owner_session", "owner-cookie");
  await revokeGuestSession();
  assert.deepEqual(state.rows.GroupMember[0], member);
  assert.equal(state.rows.GuestSession.length, 1);
  assert.equal(state.rows.GuestSession[0].id, 99);
  assert.equal(state.cookies.get("splitmate_owner_session"), "owner-cookie");
  assert.equal(state.cookies.get("splitmate_guest_session"), "");
  assert.equal(state.cookieWrites.at(-1).options.maxAge, 0);
  assert.equal(await getGuestForGroup(1), null);
  state.cookies.set("splitmate_guest_session", session.token);
  assert.equal(await getGuestForGroup(1), null, "replaying a revoked token fails");
});
test("failed revocation preserves both database session and cookie", async () => {
  const session = await join(); state.cookieWrites = [];
  state.failAt = "GuestSession.delete";
  await assert.rejects(revokeGuestSession(), /PRIVATE_DATABASE_DETAILS/);
  assert.equal(state.rows.GuestSession.length, 1);
  assert.equal(state.cookies.get("splitmate_guest_session"), session.token);
  assert.deepEqual(state.cookieWrites, []);
});
test("sign-out clears malformed or missing guest cookies safely", async () => {
  state.cookies.set("splitmate_guest_session", "bad");
  await revokeGuestSession();
  assert.equal(state.cookies.get("splitmate_guest_session"), "");
  await revokeGuestSession();
  assert.equal(state.rows.GroupMember[0].claimedAt, null);
});
