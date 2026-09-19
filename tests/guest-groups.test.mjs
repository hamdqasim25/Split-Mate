import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
const { getGroupForGuest } = await import("../src/data/guest-groups.ts");
hooks.deregister();
beforeEach(reset);
async function join() { await setGuestSessionCookie(await claimMember(token, 2)); state.writes = []; state.readOperations = []; }
const oldTime = "2000-01-01T00:00:00.000Z";
function ageActivity() {
  state.rows.GuestSession[0].lastSeenAt = oldTime;
  state.rows.GroupMember[0].lastActiveAt = oldTime;
}
test("returns only safe group, current identity, active members and activity", async () => {
  await join();
  state.rows.Group[0].email = "private@example.com";
  const base = state.rows.GroupMember[0];
  state.rows.GroupMember.push(
    { ...base, id: 1, name: "Owner", userId: 7, role: "OWNER" },
    { ...base, id: 3, name: "Waiting", claimedAt: null },
    { ...base, id: 4, name: "Inactive", isActive: false },
    { ...base, id: 5, name: "Other group", groupId: 99 },
  );
  const result = await getGroupForGuest(token);
  assert.deepEqual(result.group, { id: 1, name: "Football" });
  assert.deepEqual(result.currentGuest, { id: 2, name: "Jaher" });
  assert.deepEqual(result.members, [
    { id: 1, name: "Owner", joined: true }, { id: 2, name: "Jaher", joined: true }, { id: 3, name: "Waiting", joined: false },
  ]);
  assert.deepEqual(Object.keys(result.activity[0]).sort(), ["createdAt", "description", "id"]);
  assert.doesNotMatch(JSON.stringify(result), /email|userId|tokenHash|shareToken|expiresAt|Inactive|Other group/);
});
test("returns newest 10 allowed events with descending ID tie-break", async () => {
  await join();
  state.rows.ActivityEvent = Array.from({ length: 14 }, (_, i) => ({
    id: i + 1, groupId: 1, eventType: "MEMBER_CLAIMED", description: `Event ${i + 1}`,
    createdAt: i < 7 ? "2026-01-01T00:00:00Z" : "2026-01-02T00:00:00Z",
  }));
  state.rows.ActivityEvent.push(
    { id: 99, groupId: 99, eventType: "MEMBER_CLAIMED", description: "Other group", createdAt: "2027-01-01" },
    { id: 100, groupId: 1, eventType: "UNKNOWN_PRIVATE_EVENT", description: "Private", createdAt: "2027-01-01" },
  );
  assert.deepEqual((await getGroupForGuest(token)).activity.map(event => event.id), [14, 13, 12, 11, 10, 9, 8, 7, 6, 5]);
});
test("missing cookie or malformed URL cannot load private lists or write activity", async () => {
  assert.equal(await getGroupForGuest(token), null);
  assert.equal(await getGroupForGuest("bad"), null);
  assert.ok(!state.readOperations.some(op => op.endsWith(".all")));
  assert.deepEqual(state.writes, []);
});
for (const [label, alter] of [
  ["expired session", () => { state.rows.GuestSession[0].expiresAt = oldTime; }],
  ["malformed cookie", () => { state.cookies.set("splitmate_guest_session", "bad"); }],
  ["unknown cookie", () => { state.cookies.set("splitmate_guest_session", token); }],
  ["inactive member", () => { state.rows.GroupMember[0].isActive = false; }],
  ["missing member", () => { state.rows.GroupMember = []; }],
  ["missing group", () => { state.rows.Group = []; }],
  ["wrong membership", () => { state.rows.GroupMember[0].groupId = 99; }],
]) test(`rejects ${label} before returning data or tracking activity`, async () => {
  await join(); alter();
  assert.equal(await getGroupForGuest(token), null);
  assert.ok(!state.readOperations.some(op => op.endsWith(".all")));
  assert.deepEqual(state.writes, []);
});
test("valid session for one group cannot authenticate another group's URL", async () => {
  await join();
  const otherToken = Buffer.alloc(32, 2).toString("base64url");
  state.rows.Group.push({ id: 99, name: "Private other group", shareToken: otherToken, shareLinkEnabled: true });
  assert.equal(await getGroupForGuest(otherToken), null);
  assert.deepEqual(state.writes, []);
});
test("disabled invitations do not eject authenticated guests", async () => {
  await join(); state.rows.Group[0].shareLinkEnabled = false;
  assert.equal((await getGroupForGuest(token)).currentGuest.name, "Jaher");
});
test("successful access refreshes stale timestamps together without extending expiry", async () => {
  await join(); ageActivity();
  const expiry = state.rows.GuestSession[0].expiresAt;
  const before = Date.now();
  await getGroupForGuest(token);
  const seen = state.rows.GuestSession[0].lastSeenAt;
  assert.ok(Date.parse(seen) >= before && Date.parse(seen) <= Date.now());
  assert.equal(state.rows.GroupMember[0].lastActiveAt, seen);
  assert.equal(state.rows.GuestSession[0].expiresAt, expiry);
  assert.deepEqual(state.writes, ["GuestSession.updateAll", "GroupMember.updateAll"]);
  state.writes = [];
  await getGroupForGuest(token);
  assert.deepEqual(state.writes, [], "repeat access within five minutes causes no writes");
  assert.equal(state.rows.ActivityEvent.length, 1, "page reads do not create feed events");
});
test("member activity can refresh independently of a fresh session timestamp", async () => {
  await join(); state.rows.GroupMember[0].lastActiveAt = null;
  await getGroupForGuest(token);
  assert.deepEqual(state.writes, ["GroupMember.updateAll"]);
});
for (const failAt of ["GroupMember.all", "ActivityEvent.all", "GuestSession.updateAll", "GroupMember.updateAll"]) test(`failure at ${failAt} rolls back activity updates`, async () => {
  await join(); ageActivity(); state.failAt = failAt;
  const before = structuredClone(state.rows);
  await assert.rejects(getGroupForGuest(token), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
