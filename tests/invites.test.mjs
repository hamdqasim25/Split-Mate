import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { resolveInvite, claimMember, InviteError } = await import("../src/data/invites.ts");
hooks.deregister();
beforeEach(reset);

test("invite exposes only group identity and active unclaimed guest names", async () => {
  const base = state.rows.GroupMember[0];
  for (const change of [{ isActive: false }, { claimedAt: new Date().toISOString() }, { role: "OWNER" }, { userId: 7 }, { groupId: 99 }]) {
    state.rows.GroupMember.push({ ...base, id: state.rows.GroupMember.length + 3, ...change });
  }
  assert.deepEqual(await resolveInvite(token), { status: "valid", group: { id: 1, name: "Football" }, members: [{ id: 2, name: "Jaher" }] });
});
test("invalid and noncanonical tokens do not query the database", async () => {
  for (const value of [null, {}, "bad", "a".repeat(44), token.slice(0, -1) + "F"]) assert.deepEqual(await resolveInvite(value), { status: "invalid" });
  assert.equal(state.reads, 0);
});
test("unknown token and disabled link are rejected without group information", async () => {
  assert.deepEqual(await resolveInvite(Buffer.alloc(32, 2).toString("base64url")), { status: "invalid" });
  state.rows.Group[0].shareLinkEnabled = false;
  assert.deepEqual(await resolveInvite(token), { status: "disabled" });
});
test("claim atomically timestamps member, stores only token hash and logs activity", async () => {
  const result = await claimMember(token, 2);
  const member = state.rows.GroupMember[0];
  const session = state.rows.GuestSession[0];
  assert.ok(member.claimedAt);
  assert.equal(member.lastActiveAt, member.claimedAt);
  assert.equal(session.groupMemberId, member.id);
  assert.equal(session.createdAt, member.claimedAt);
  assert.equal(session.lastSeenAt, member.claimedAt);
  assert.equal(session.expiresAt, result.expiresAt.toISOString());
  assert.equal(session.tokenHash, createHash("sha256").update(result.token).digest("hex"));
  assert.ok(!JSON.stringify(state.rows).includes(result.token));
  assert.deepEqual(state.rows.ActivityEvent[0], {
    id: 1, groupId: 1, memberId: 2, eventType: "MEMBER_CLAIMED", description: "Jaher joined the group",
    entityType: "GROUP_MEMBER", entityId: 2, createdAt: member.claimedAt,
  });
  assert.equal(state.commits, 1);
});
for (const [label, change] of Object.entries({ crossGroup: { groupId: 99 }, claimed: { claimedAt: "2026-01-01" }, inactive: { isActive: false }, owner: { role: "OWNER" }, linked: { userId: 7 } })) {
  test(`rejects ${label} member without session or activity`, async () => {
    Object.assign(state.rows.GroupMember[0], change);
    const before = structuredClone(state.rows);
    await assert.rejects(claimMember(token, 2), InviteError);
    assert.deepEqual(state.rows, before);
  });
}
test("disabled and unknown invites cannot claim", async () => {
  state.rows.Group[0].shareLinkEnabled = false;
  await assert.rejects(claimMember(token, 2), InviteError);
  await assert.rejects(claimMember(Buffer.alloc(32, 3).toString("base64url"), 2), InviteError);
  assert.equal(state.rows.GuestSession.length, 0);
});
test("malformed inputs and missing member fail safely", async () => {
  for (const value of [null, "2", 0, -1, 1.5, 2147483648]) await assert.rejects(claimMember(token, value), InviteError);
  await assert.rejects(claimMember("bad", 2), InviteError);
  await assert.rejects(claimMember(token, 999), InviteError);
  assert.equal(state.commits, 0);
});
for (const failAt of ["Group.updateAll", "GroupMember.updateAll", "GuestSession.create", "ActivityEvent.create"]) {
  test(`rolls back when ${failAt} fails`, async () => {
    state.failAt = failAt;
    const before = structuredClone(state.rows);
    await assert.rejects(claimMember(token, 2), /PRIVATE_DATABASE_DETAILS/);
    assert.deepEqual(state.rows, before);
    assert.equal(state.rollbacks, 1);
  });
}
test("competing claims produce one winner under simulated database locking", async () => {
  const results = await Promise.allSettled([claimMember(token, 2), claimMember(token, 2)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(state.rows.GuestSession.length, 1);
  assert.equal(state.rows.ActivityEvent.length, 1);
});
