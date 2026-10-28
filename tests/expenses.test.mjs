import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";

const hooks = installHooks();
const { getExpenseFormContext, previewExpense, createExpense, ExpenseError } = await import("../src/data/expenses.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
beforeEach(reset);
const ownerAccess = { kind: "owner", groupId: 1 };
const guestAccess = { kind: "guest", shareToken: token };
function owner() {
  state.rows.User.push({ id: 7, name: "Account name", email: "private@example.com", passwordHash: "private" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner member", role: "OWNER", isActive: true, claimedAt: "2026-01-01" });
}
async function guest() { await setGuestSessionCookie(await claimMember(token, 2)); }

test("owner resolves to the group's member ID and display name, not User ID/name", async () => {
  owner();
  assert.deepEqual((await getExpenseFormContext(ownerAccess)).currentMember, { id: 10, name: "Owner member" });
});
test("guest with null userId resolves through a verified claimed-member session", async () => {
  await guest();
  assert.deepEqual((await getExpenseFormContext(guestAccess)).currentMember, { id: 2, name: "Jaher" });
});
test("explicit access mode preserves each identity when both cookies exist", async () => {
  owner(); await guest();
  assert.equal((await getExpenseFormContext(ownerAccess)).currentMember.id, 10);
  assert.equal((await getExpenseFormContext(guestAccess)).currentMember.id, 2);
});
test("owner and guest cookies cannot substitute for each other", async () => {
  owner(); assert.equal(await getExpenseFormContext(guestAccess), null);
  reset(); await guest(); assert.equal(await getExpenseFormContext(ownerAccess), null);
});
test("safe context includes only active same-group IDs/names including unclaimed guests", async () => {
  owner();
  state.rows.GroupMember.push(
    { ...state.rows.GroupMember[0], id: 3, name: "Inactive", isActive: false },
    { ...state.rows.GroupMember[0], id: 4, name: "Other group", groupId: 99 },
  );
  const before = structuredClone(state.rows);
  assert.deepEqual(await getExpenseFormContext(ownerAccess), {
    group: { name: "Football", currency: "GBP" }, currentMember: { id: 10, name: "Owner member" },
    members: [{ id: 2, name: "Jaher" }, { id: 10, name: "Owner member" }],
  });
  assert.deepEqual(state.rows, before, "context reads do not write expenses or activity");
  assert.deepEqual(state.writes, []);
});
test("guest context excludes session, account, share token and activity fields", async () => {
  await guest();
  assert.deepEqual(await getExpenseFormContext(guestAccess), {
    group: { name: "Football", currency: "GBP" }, currentMember: { id: 2, name: "Jaher" }, members: [{ id: 2, name: "Jaher" }],
  });
});
test("owner cannot access another owner's group even with a linked member", async () => {
  owner(); state.rows.Group[0].createdBy = 99;
  assert.equal(await getExpenseFormContext(ownerAccess), null);
  assert.ok(!state.readOperations.includes("GroupMember.all"));
});
test("guest session cannot access another group's share token", async () => {
  await guest(); const otherToken = Buffer.alloc(32, 3).toString("base64url");
  state.rows.Group.push({ id: 99, name: "Other", currency: "GBP", shareToken: otherToken });
  assert.equal(await getExpenseFormContext({ kind: "guest", shareToken: otherToken }), null);
  assert.ok(!state.readOperations.includes("GroupMember.all"));
});
for (const [label, alter] of [
  ["inactive", member => { member.isActive = false; }],
  ["cross-group", member => { member.groupId = 99; }],
  ["wrong role", member => { member.role = "MEMBER"; }],
  ["wrong account", member => { member.userId = 99; }],
]) test(`rejects ${label} owner membership`, async () => {
  owner(); alter(state.rows.GroupMember[1]);
  assert.equal(await getExpenseFormContext(ownerAccess), null);
});
for (const [label, alter] of [
  ["inactive", () => { state.rows.GroupMember[0].isActive = false; }],
  ["unclaimed", () => { state.rows.GroupMember[0].claimedAt = null; }],
  ["linked account", () => { state.rows.GroupMember[0].userId = 7; }],
  ["expired", () => { state.rows.GuestSession[0].expiresAt = "2000-01-01"; }],
  ["missing cookie", () => { state.cookies.clear(); }],
]) test(`rejects ${label} guest identity`, async () => {
  await guest(); alter(); assert.equal(await getExpenseFormContext(guestAccess), null);
});
test("missing or expired owner session cannot load form data", async () => {
  assert.equal(await getExpenseFormContext(ownerAccess), null);
  owner(); state.rows.UserSession[0].expiresAt = "2000-01-01";
  assert.equal(await getExpenseFormContext(ownerAccess), null);
});
test("missing owner membership and missing group fail closed", async () => {
  owner(); state.rows.GroupMember.pop(); assert.equal(await getExpenseFormContext(ownerAccess), null);
  state.rows.Group = []; assert.equal(await getExpenseFormContext(ownerAccess), null);
});
test("malformed targets are rejected before database reads", async () => {
  for (const groupId of [0, -1, 1.5, NaN, 2147483648, "1"]) assert.equal(await getExpenseFormContext({ kind: "owner", groupId }), null);
  assert.equal(await getExpenseFormContext({ kind: "guest", shareToken: "bad" }), null);
  assert.equal(state.reads, 0);
});
test("disabled invitations preserve access for established guests", async () => {
  await guest(); state.rows.Group[0].shareLinkEnabled = false;
  assert.equal((await getExpenseFormContext(guestAccess)).currentMember.id, 2);
});
test("database errors propagate rather than returning partial form context", async () => {
  owner(); state.failAt = "GroupMember.all";
  await assert.rejects(getExpenseFormContext(ownerAccess), /PRIVATE_DATABASE_DETAILS/);
});

const validInput = () => ({ description: "  Court booking  ", amount: "10.00", paidByMemberId: "10", participantIds: ["20", "10", "2"] });
function expenseMembers() {
  owner();
  state.rows.GroupMember.push({ ...state.rows.GroupMember[0], id: 20, name: "Waiting guest" });
}
test("preview calculates safe canonical shares without writing any records", async () => {
  expenseMembers();
  const before = structuredClone(state.rows);
  const result = await previewExpense(ownerAccess, validInput());
  assert.deepEqual(result.input, { description: "Court booking", amount: "10.00", paidByMemberId: "10", participantIds: ["2", "10", "20"] });
  assert.deepEqual(result.review, {
    description: "Court booking", amount: "10.00", payer: { id: 10, name: "Owner member" },
    participants: [{ id: 2, name: "Jaher", amount: "3.34" }, { id: 10, name: "Owner member", amount: "3.33" }, { id: 20, name: "Waiting guest", amount: "3.33" }],
  });
  assert.deepEqual(state.rows, before);
  assert.deepEqual(state.writes, []);
});
for (const [label, patch] of [
  ["blank description", { description: "  " }], ["non-text description", { description: 1 }],
  ["long description", { description: "x".repeat(1001) }], ["zero amount", { amount: "0.00" }],
  ["negative amount", { amount: "-1" }], ["fractional penny", { amount: "1.001" }],
  ["numeric pounds", { amount: 10 }], ["empty participants", { participantIds: [] }],
  ["non-list participants", { participantIds: "2" }], ["duplicate participants", { participantIds: ["2", "2"] }],
  ["too many participants", { participantIds: Array(52).fill("2") }], ["malformed payer", { paidByMemberId: "10oops" }],
  ["numeric payer", { paidByMemberId: 10 }], ["malformed participant", { participantIds: ["2.0"] }],
  ["client shares", { shares: ["0.01"] }], ["client actor", { memberId: 20 }],
]) test(`preview and saving reject ${label} without writes`, async () => {
  expenseMembers();
  const before = structuredClone(state.rows);
  for (const method of [previewExpense, createExpense]) await assert.rejects(method(ownerAccess, { ...validInput(), ...patch }, randomUUID()), ExpenseError);
  assert.deepEqual(state.rows, before);
});
for (const role of ["payer", "participant"]) for (const eligibility of ["foreign", "inactive", "missing"]) {
  test(`rejects ${eligibility} ${role} in both preview and save`, async () => {
    expenseMembers();
    if (eligibility !== "missing") state.rows.GroupMember.push({ ...state.rows.GroupMember[0], id: 90, groupId: eligibility === "foreign" ? 99 : 1, isActive: eligibility !== "inactive" });
    const input = { ...validInput(), ...(role === "payer" ? { paidByMemberId: "90" } : { participantIds: ["2", "90"] }) };
    const before = structuredClone(state.rows);
    for (const method of [previewExpense, createExpense]) await assert.rejects(method(ownerAccess, input, randomUUID()), ExpenseError);
    assert.deepEqual(state.rows, before);
  });
}
for (const kind of ["owner", "guest"]) test(`${kind} creates expense, exact participant shares and actor event atomically`, async () => {
  expenseMembers(); if (kind === "guest") await guest();
  const access = kind === "owner" ? ownerAccess : guestAccess;
  const beforeCommits = state.commits;
  const result = await createExpense(access, validInput(), randomUUID());
  assert.equal(state.commits, beforeCommits + 1);
  assert.deepEqual(result, { id: 1, groupId: 1 });
  const expense = state.rows.Expense[0];
  assert.equal(expense.description, "Court booking");
  assert.equal(expense.amount, "10.00");
  assert.equal(expense.paidByMemberId, 10);
  assert.equal(expense.groupId, 1);
  assert.equal(expense.splitMethod, "EQUAL");
  assert.ok(Number.isFinite(Date.parse(expense.createdAt)));
  assert.deepEqual(state.rows.ExpenseParticipant.map(({ expenseId, memberId, amountOwed }) => ({ expenseId, memberId, amountOwed })), [
    { expenseId: 1, memberId: 2, amountOwed: "3.34" }, { expenseId: 1, memberId: 10, amountOwed: "3.33" }, { expenseId: 1, memberId: 20, amountOwed: "3.33" },
  ]);
  const event = state.rows.ActivityEvent.find(row => row.eventType === "EXPENSE_CREATED");
  assert.equal(event.memberId, kind === "owner" ? 10 : 2, "actor is authenticated member, not chosen payer");
  assert.equal(event.groupId, 1); assert.equal(event.entityType, "EXPENSE"); assert.equal(event.entityId, 1);
  assert.equal(event.createdAt, expense.createdAt);
  assert.match(event.description, /Court booking.*£10.00/);
});
test("payer need not participate; tiny totals may produce zero-pence participant shares", async () => {
  expenseMembers();
  await createExpense(ownerAccess, { ...validInput(), amount: "0.01", participantIds: ["20", "2"] }, randomUUID());
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => row.amountOwed), ["0.01", "0.00"]);
});
test("save revalidates membership changed after preview", async () => {
  expenseMembers(); const preview = await previewExpense(ownerAccess, validInput());
  state.rows.GroupMember.find(row => row.id === 20).isActive = false;
  await assert.rejects(createExpense(ownerAccess, preview.input, randomUUID()), ExpenseError);
  assert.equal(state.rows.Expense.length, 0);
});
test("save revalidates guest expiry and does not fall back to owner cookie", async () => {
  expenseMembers(); await guest();
  const preview = await previewExpense(guestAccess, validInput());
  state.rows.GuestSession[0].expiresAt = "2000-01-01";
  await assert.rejects(createExpense(guestAccess, preview.input, randomUUID()), ExpenseError);
  assert.equal(state.rows.Expense.length, 0);
});
test("GBP-only writes reject other group currencies", async () => {
  expenseMembers(); state.rows.Group[0].currency = "USD";
  await assert.rejects(previewExpense(ownerAccess, validInput()), /GBP/);
  await assert.rejects(createExpense(ownerAccess, validInput(), randomUUID()), /GBP/);
});
for (const failCreateAt of [1, 2, 3, 4, 5]) test(`failure at expense write ${failCreateAt} rolls back all rows`, async () => {
  expenseMembers(); state.createCalls = 0; state.failCreateAt = failCreateAt;
  const before = structuredClone(state.rows);
  await assert.rejects(createExpense(ownerAccess, validInput(), randomUUID()), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
  assert.equal(state.rollbacks, 1);
});

const customInput = () => ({ ...validInput(), shares: [
  { memberId: "10", amount: "5.00" }, { memberId: "2", amount: "3.00" }, { memberId: "20", amount: "2.00" },
] });
for (const kind of ["owner", "guest"]) test(`${kind} saves exact custom shares and CUSTOM method`, async () => {
  expenseMembers(); if (kind === "guest") await guest();
  await createExpense(kind === "owner" ? ownerAccess : guestAccess, customInput(), randomUUID());
  assert.equal(state.rows.Expense[0].splitMethod, "CUSTOM");
  assert.deepEqual(Object.fromEntries(state.rows.ExpenseParticipant.map(row => [row.memberId, row.amountOwed])), { 2: "3.00", 10: "5.00", 20: "2.00" });
  assert.equal(state.rows.ActivityEvent.filter(event => event.eventType === "EXPENSE_CREATED").length, 1);
});
for (const [label, shares] of [
  ["missing share", [{ memberId: "2", amount: "10" }]],
  ["duplicate member", [{ memberId: "2", amount: "3" }, { memberId: "2", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["unselected member", [{ memberId: "99", amount: "3" }, { memberId: "10", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["negative", [{ memberId: "2", amount: "-1" }, { memberId: "10", amount: "6" }, { memberId: "20", amount: "5" }]],
  ["fractional penny", [{ memberId: "2", amount: "3.001" }, { memberId: "10", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["under total", [{ memberId: "2", amount: "2" }, { memberId: "10", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["over total", [{ memberId: "2", amount: "4" }, { memberId: "10", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["numeric value", [{ memberId: "2", amount: 3 }, { memberId: "10", amount: "3" }, { memberId: "20", amount: "4" }]],
  ["malformed list", "10.00"], ["null list", null],
]) test(`custom validation rejects ${label} without partial writes`, async () => {
  expenseMembers(); const before = structuredClone(state.rows);
  await assert.rejects(createExpense(ownerAccess, { ...validInput(), shares }, randomUUID()), ExpenseError);
  assert.deepEqual(state.rows, before);
});
test("zero custom shares persist and equal confirmed shares retain EQUAL method", async () => {
  expenseMembers(); const input = customInput();
  input.shares = [{ memberId: "2", amount: "0" }, { memberId: "10", amount: "0" }, { memberId: "20", amount: "10" }];
  await createExpense(ownerAccess, input, randomUUID());
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => row.amountOwed), ["0.00", "0.00", "10.00"]);
  const baseline = await previewExpense(ownerAccess, validInput());
  await createExpense(ownerAccess, { ...validInput(), shares: baseline.review.participants.map(member => ({ memberId: String(member.id), amount: member.amount })) }, randomUUID());
  assert.equal(state.rows.Expense[1].splitMethod, "EQUAL");
});
test("natural order is shared by context and review while the lowest ID gets the remainder", async () => {
  expenseMembers();
  for (const member of state.rows.GroupMember) member.addedAt = member.id === 10 ? "2026-01-01" : member.id === 20 ? "2026-01-02" : "2026-01-03";
  assert.deepEqual((await getExpenseFormContext(ownerAccess)).members.map(member => member.id), [10, 20, 2]);
  const preview = await previewExpense(ownerAccess, validInput());
  assert.deepEqual(preview.input.participantIds, ["10", "20", "2"]);
  assert.deepEqual(preview.review.participants.map(member => [member.id, member.amount]), [[10, "3.33"], [20, "3.33"], [2, "3.34"]]);
});
for (const change of ["inactive", "foreign"]) test(`custom saving rechecks ${change} members after review`, async () => {
  expenseMembers(); await previewExpense(ownerAccess, validInput());
  const member = state.rows.GroupMember.find(row => row.id === 20);
  if (change === "inactive") member.isActive = false; else member.groupId = 99;
  await assert.rejects(createExpense(ownerAccess, customInput(), randomUUID()), ExpenseError);
  assert.equal(state.rows.Expense.length, 0);
});
test("custom participant write failure rolls back expense, shares and activity", async () => {
  expenseMembers(); state.failCreateAt = 3; const before = structuredClone(state.rows);
  await assert.rejects(createExpense(ownerAccess, customInput(), randomUUID()), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});

for (const kind of ["owner", "guest"]) test(`${kind} lost-response and simulated concurrent retries create one expense/share/event set`, async () => {
  expenseMembers(); if (kind === "guest") await guest();
  const access = kind === "owner" ? ownerAccess : guestAccess;
  const key = randomUUID();
  const results = await Promise.all(Array.from({ length: 8 }, () => createExpense(access, customInput(), key)));
  assert.ok(results.every(result => result.id === results[0].id));
  const before = structuredClone(state.rows);
  assert.deepEqual(await createExpense(access, customInput(), key), results[0]);
  assert.deepEqual(state.rows, before);
  assert.equal(state.rows.Expense.length, 1);
  assert.equal(state.rows.ExpenseParticipant.length, 3);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_CREATED").length, 1);
  assert.equal(state.rows.Expense[0].requestKey, key);
  assert.equal(JSON.parse(state.rows.Expense[0].creationDetails).actorId, kind === "owner" ? 10 : 2);
});
for (const [label, patch] of [
  ["description", { description: "Changed" }],
  ["total", { amount: "11", shares: [{ memberId: "10", amount: "6" }, { memberId: "2", amount: "3" }, { memberId: "20", amount: "2" }] }],
  ["payer", { paidByMemberId: "2" }],
  ["shares", { shares: [{ memberId: "10", amount: "4" }, { memberId: "2", amount: "4" }, { memberId: "20", amount: "2" }] }],
]) test(`saved key rejects changed ${label} without financial changes`, async () => {
  expenseMembers(); const key = randomUUID(); await createExpense(ownerAccess, customInput(), key);
  const before = structuredClone(state.rows);
  await assert.rejects(createExpense(ownerAccess, { ...customInput(), ...patch }, key), /already used for different expense/);
  assert.deepEqual(state.rows, before);
});
test("canonical formatting and reordered participants/shares replay successfully", async () => {
  expenseMembers(); const key = randomUUID(); const first = await createExpense(ownerAccess, customInput(), key);
  const before = structuredClone(state.rows);
  const input = { ...customInput(), description: "Court booking", amount: " 10.0 ", participantIds: ["2", "20", "10"],
    shares: [{ memberId: "20", amount: " 2 " }, { memberId: "2", amount: "3.0" }, { memberId: "10", amount: "5" }] };
  assert.deepEqual(await createExpense(ownerAccess, input, key), first);
  assert.deepEqual(state.rows, before);
});
test("implicit equal and explicit equal shares have the same creation identity", async () => {
  expenseMembers(); const key = randomUUID(); const first = await createExpense(ownerAccess, validInput(), key);
  const preview = await previewExpense(ownerAccess, validInput());
  assert.deepEqual(await createExpense(ownerAccess, { ...validInput(), participantIds: ["10", "2", "20"],
    shares: preview.review.participants.map(row => ({ memberId: String(row.id), amount: row.amount })) }, key), first);
});
test("different keys allow deliberately identical expenses", async () => {
  expenseMembers();
  const first = await createExpense(ownerAccess, customInput(), randomUUID());
  const second = await createExpense(ownerAccess, customInput(), randomUUID());
  assert.notEqual(first.id, second.id);
  assert.equal(state.rows.ExpenseParticipant.length, 6);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_CREATED").length, 2);
});
for (const key of [undefined, null, "", "bad", 123, "11111111-1111-1111-8111-111111111111", "11111111-1111-4111-0111-111111111111"]) test(`rejects invalid creation key ${JSON.stringify(key)}`, async () => {
  expenseMembers(); const before = structuredClone(state.rows);
  await assert.rejects(createExpense(ownerAccess, validInput(), key), /request is missing or invalid/);
  assert.deepEqual(state.rows, before);
});
test("request key is not proof of actor identity or group access", async () => {
  expenseMembers(); await guest(); const key = randomUUID(); await createExpense(ownerAccess, customInput(), key);
  const before = structuredClone(state.rows);
  await assert.rejects(createExpense(guestAccess, customInput(), key), /different expense details/);
  state.cookies.clear();
  await assert.rejects(createExpense(ownerAccess, customInput(), key), /access/);
  await assert.rejects(createExpense(guestAccess, customInput(), key), /access/);
  assert.deepEqual(state.rows, before);
});
test("authorised cross-group replay is rejected without returning the other expense", async () => {
  expenseMembers(); const key = randomUUID(); await createExpense(ownerAccess, customInput(), key);
  state.rows.Group.push({ id: 99, createdBy: 7, name: "Other", currency: "GBP" });
  state.rows.GroupMember.push({ id: 100, groupId: 99, userId: 7, role: "OWNER", isActive: true, name: "Owner" });
  const before = structuredClone(state.rows);
  await assert.rejects(createExpense({ kind: "owner", groupId: 99 }, customInput(), key), /different expense details/);
  assert.deepEqual(state.rows, before);
});
for (const kind of ["owner", "guest"]) test(`${kind} session revoked while waiting for lock cannot replay`, async () => {
  expenseMembers(); if (kind === "guest") await guest();
  const access = kind === "owner" ? ownerAccess : guestAccess;
  const key = randomUUID(); await createExpense(access, customInput(), key);
  const before = structuredClone(state.rows);
  state.afterGroupLock = rows => { rows[kind === "owner" ? "UserSession" : "GuestSession"] = []; };
  await assert.rejects(createExpense(access, customInput(), key), /access/);
  assert.deepEqual(state.rows, before);
});
test("replay does not require formerly selected participants to remain active", async () => {
  expenseMembers(); const key = randomUUID(); const first = await createExpense(ownerAccess, customInput(), key);
  state.rows.GroupMember.find(row => row.id === 20).isActive = false;
  const before = structuredClone(state.rows);
  assert.deepEqual(await createExpense(ownerAccess, customInput(), key), first);
  assert.deepEqual(state.rows, before);
});
for (const failAt of ["ExpenseParticipant.create", "ActivityEvent.create"]) test(`${failAt} rollback leaves key reusable`, async () => {
  expenseMembers(); const key = randomUUID(); const before = structuredClone(state.rows); state.failAt = failAt;
  await assert.rejects(createExpense(ownerAccess, customInput(), key), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
  state.failAt = null;
  await createExpense(ownerAccess, customInput(), key);
  assert.equal(state.rows.Expense.length, 1);
  assert.equal(state.rows.ExpenseParticipant.length, 3);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_CREATED").length, 1);
});
