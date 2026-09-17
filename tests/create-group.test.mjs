import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";
import { resetDatabase, state } from "./helpers/group-database.mjs";

// Next resolves these imports in the app. The Node runner replaces only the
// server-only marker and database; the real service and crypto run unchanged.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    }
    if (specifier === "@/prisma/db") {
      return {
        url: new URL("./helpers/group-database.mjs", import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
const { createGroup, GroupCreationError } = await import("../src/data/groups.ts");
hooks.deregister();

const input = {
  name: " Friday  Football ",
  description: " Weekly games ",
  currency: "GBP",
  memberNames: [" Ismaeel ", "Jaher"],
};

beforeEach(() => resetDatabase());

test("creates the group, owner, guests and activity in one transaction", async () => {
  const result = await createGroup(7, input);
  const [group] = state.rows.Group;
  const [owner, ...guests] = state.rows.GroupMember;
  const [activity] = state.rows.ActivityEvent;

  assert.equal(state.transactions, 1);
  assert.equal(state.commits, 1);
  assert.equal(state.writes, 5);
  assert.equal(group.name, "Friday Football");
  assert.equal(group.description, "Weekly games");
  assert.equal(group.currency, "GBP");
  assert.equal(group.createdBy, 7);
  assert.equal(group.shareLinkEnabled, true);
  assert.match(group.shareToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(group.shareToken, "base64url").length, 32);

  assert.deepEqual(owner, {
    id: 1,
    groupId: group.id,
    userId: 7,
    name: "Hamdi",
    role: "OWNER",
    claimedAt: group.createdAt,
    lastActiveAt: group.createdAt,
    addedAt: group.createdAt,
    isActive: true,
  });
  assert.deepEqual(guests.map((member) => member.name), ["Ismaeel", "Jaher"]);
  for (const guest of guests) {
    assert.equal(guest.groupId, group.id);
    assert.equal(guest.userId, null);
    assert.equal(guest.claimedAt, null);
    assert.equal(guest.lastActiveAt, null);
    assert.equal(guest.role, "MEMBER");
    assert.equal(guest.isActive, true);
  }
  assert.deepEqual(activity, {
    id: 1,
    groupId: group.id,
    memberId: owner.id,
    eventType: "GROUP_CREATED",
    description: "Hamdi created the group",
    entityType: "GROUP",
    entityId: group.id,
    createdAt: group.createdAt,
  });
  assert.deepEqual(result, {
    id: group.id,
    name: group.name,
    description: group.description,
    currency: group.currency,
    createdAt: group.createdAt,
  });
  assert.deepEqual(input.memberNames, [" Ismaeel ", "Jaher"]);
});

test("uses the stored owner name and supports an owner-only group", async () => {
  resetDatabase({ owner: { id: 7, name: "  Different   Owner " } });
  await createGroup(7, { name: "Trip", currency: "GBP", memberNames: [] });
  assert.equal(state.rows.GroupMember.length, 1);
  assert.equal(state.rows.GroupMember[0].name, "Different Owner");
  assert.equal(state.rows.Group[0].description, null);
});

test("generates a fresh token for each created group", async () => {
  await createGroup(7, input);
  await createGroup(7, input);
  assert.notEqual(state.rows.Group[0].shareToken, state.rows.Group[1].shareToken);
});

const invalidInputs = [
  ["missing body", undefined],
  ["null body", null],
  ["array body", []],
  ["blank group name", { ...input, name: "  " }],
  ["non-string group name", { ...input, name: 5 }],
  ["long group name", { ...input, name: "a".repeat(101) }],
  ["long description", { ...input, description: "a".repeat(1001) }],
  ["non-string description", { ...input, description: {} }],
  ["unsupported currency", { ...input, currency: "USD" }],
  ["missing currency", { ...input, currency: undefined }],
  ["non-array members", { ...input, memberNames: "Jaher" }],
  ["too many members", { ...input, memberNames: Array.from({ length: 51 }, (_, i) => `Member ${i}`) }],
  ["blank member", { ...input, memberNames: [" "] }],
  ["non-string member", { ...input, memberNames: [null] }],
  ["long member name", { ...input, memberNames: ["a".repeat(101)] }],
  ["duplicate names", { ...input, memberNames: ["Jaher", " jaher "] }],
  ["duplicate whitespace", { ...input, memberNames: ["Jaher A", "Jaher   A"] }],
  ["duplicate Unicode names", { ...input, memberNames: ["Jaher", "Ｊａｈｅｒ"] }],
  ["client owner ID", { ...input, createdBy: 99 }],
  ["client token", { ...input, shareToken: "attacker-chosen" }],
  ["client role", { ...input, role: "OWNER" }],
];

for (const [label, value] of invalidInputs) {
  test(`rejects ${label} before opening a transaction`, async () => {
    await assert.rejects(createGroup(7, value), (error) => {
      assert.ok(error instanceof GroupCreationError);
      assert.equal(error.code, "INVALID_INPUT");
      return true;
    });
    assert.equal(state.transactions, 0);
  });
}

test("rejects a guest matching the owner's name before writing", async () => {
  await assert.rejects(createGroup(7, { ...input, memberNames: [" HAMDI "] }), {
    code: "INVALID_INPUT",
    field: "memberNames",
  });
  assert.equal(state.writes, 0);
  assert.equal(state.commits, 0);
});

test("rejects invalid owner IDs without database access", async () => {
  for (const ownerId of [undefined, null, "7", 0, -1, 1.5, NaN, Infinity, 2_147_483_648]) {
    await assert.rejects(createGroup(ownerId, input), { code: "OWNER_NOT_FOUND" });
  }
  assert.equal(state.transactions, 0);
});

test("rejects a missing owner before writing", async () => {
  resetDatabase({ owner: null });
  await assert.rejects(createGroup(7, input), { code: "OWNER_NOT_FOUND" });
  assert.equal(state.writes, 0);
  assert.equal(state.commits, 0);
});

for (const [index, operation] of ["group", "owner", "first guest", "second guest", "activity"].entries()) {
  test(`propagates a failed ${operation} write so the transaction can roll back`, async () => {
    resetDatabase({ failAt: index + 1 });
    await assert.rejects(createGroup(7, input), (error) => error === state.failure);
    assert.equal(state.transactions, 1);
    assert.equal(state.commits, 0);
    assert.equal(state.rollbacks, 1);
    assert.equal(state.writes, index + 1);
    assert.deepEqual(state.rows, { Group: [], GroupMember: [], ActivityEvent: [] });
  });
}
