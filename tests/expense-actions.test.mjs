import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { ownerExpenseAction, guestExpenseAction } = await import("../src/app/actions/expenses.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
beforeEach(reset);
function owner() {
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true });
}
function form(intent = "review") {
  const data = new FormData();
  for (const [name, value] of Object.entries({ description: "Dinner", amount: "10.01", paidByMemberId: "2", intent })) data.set(name, value);
  data.append("participantIds", "10"); data.append("participantIds", "2");
  if (intent === "save") {
    data.set("confirmed", "yes");
    data.append("shareMemberId", "2"); data.append("shareAmount", "5.01");
    data.append("shareMemberId", "10"); data.append("shareAmount", "5.00");
  }
  return data;
}
for (const kind of ["owner", "guest"]) test(`${kind} review, edit and save use shared service and redirect after commit`, async () => {
  owner(); if (kind === "guest") await setGuestSessionCookie(await claimMember(token, 2));
  const action = kind === "owner" ? ownerExpenseAction.bind(null, 1) : guestExpenseAction.bind(null, token);
  const review = await action({}, form());
  assert.equal(review.review.amount, "10.01");
  assert.deepEqual(review.review.participants.map(row => row.amount), ["5.01", "5.00"]);
  assert.equal(state.rows.Expense.length, 0);
  const edit = await action(review, form("edit"));
  assert.equal(edit.input.description, "Dinner"); assert.equal(edit.review, undefined);
  assert.equal(state.rows.Expense.length, 0);
  const save = form("save");
  save.set("shares", "0.01"); save.set("memberId", "999"); save.set("redirect", "https://evil.example");
  const destination = kind === "owner" ? "/groups/1" : `/g/${token}/group`;
  await assert.rejects(action({ review: { amount: "0.01" } }, save), { destination });
  assert.equal(state.rows.Expense[0].amount, "10.01");
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => row.amountOwed), ["5.01", "5.00"]);
  assert.deepEqual(state.revalidated, [destination, "/dashboard"]);
});
test("save requires explicit confirmation and unknown intents fail safely", async () => {
  owner();
  const data = form("save"); data.delete("confirmed");
  assert.match((await ownerExpenseAction(1, {}, data)).error, /Review/);
  assert.match((await ownerExpenseAction(1, {}, form("delete"))).error, /Review/);
  assert.equal(state.rows.Expense.length, 0);
});
test("invalid fields retain editable input and never return a review", async () => {
  owner(); const data = form(); data.set("amount", "0");
  const result = await ownerExpenseAction(1, {}, data);
  assert.ok(result.error); assert.equal(result.review, undefined); assert.equal(result.input.amount, "0");
});
test("malformed, repeated or file-valued fields are rejected", async () => {
  owner();
  const inputs = [form(), form(), form(), form()];
  inputs[0].append("amount", "20"); inputs[1].set("description", new Blob(["bad"]));
  inputs[2].append("participantIds", new Blob(["bad"])); inputs[3].delete("paidByMemberId");
  for (const data of inputs) assert.ok((await ownerExpenseAction(1, {}, data)).error);
  assert.equal(state.rows.Expense.length, 0);
});
test("owner/guest access failures return safe errors without saving", async () => {
  assert.ok((await ownerExpenseAction(1, {}, form("save"))).error);
  owner(); assert.ok((await guestExpenseAction(token, {}, form("save"))).error);
  assert.ok((await ownerExpenseAction(99, {}, form("save"))).error);
  assert.equal(state.rows.Expense.length, 0);
});
test("unexpected persistence failure rolls back and does not redirect or expose details", async () => {
  owner(); state.failAt = "ActivityEvent.create";
  const result = await ownerExpenseAction(1, {}, form("save"));
  assert.match(result.error, /Unable to save or review/); assert.doesNotMatch(result.error, /PRIVATE/);
  assert.equal(result.review.description, "Dinner"); assert.equal(result.input.description, "Dinner");
  assert.equal(state.rows.Expense.length, 0); assert.equal(state.rows.ExpenseParticipant.length, 0);
  assert.deepEqual(state.revalidated, []);
});
test("custom actions persist confirmed amounts rather than overwriting with equal shares", async () => {
  owner(); const data = form("save"); data.delete("shareAmount"); data.append("shareAmount", "8"); data.append("shareAmount", "2.01");
  await assert.rejects(ownerExpenseAction(1, {}, data), { destination: "/groups/1" });
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => row.amountOwed), ["8.00", "2.01"]);
  assert.equal(state.rows.Expense[0].splitMethod, "CUSTOM");
});
test("mismatched totals return safe equal baseline plus original edits for correction", async () => {
  owner(); const data = form("save"); data.delete("shareAmount"); data.append("shareAmount", "8"); data.append("shareAmount", "3");
  const result = await ownerExpenseAction(1, {}, data);
  assert.match(result.error, /exactly/);
  assert.deepEqual(result.input.shares.map(row => row.amount), ["8", "3"]);
  assert.deepEqual(result.review.participants.map(row => row.amount), ["5.01", "5.00"]);
  assert.equal(state.rows.Expense.length, 0);
});
test("missing, misaligned and file-valued share fields cannot bypass server validation", async () => {
  owner();
  const inputs = [form("save"), form("save"), form("save")];
  inputs[0].delete("shareAmount"); inputs[0].delete("shareMemberId");
  inputs[1].append("shareMemberId", "99");
  inputs[2].set("shareAmount", new Blob(["3"]));
  for (const input of inputs) assert.ok((await ownerExpenseAction(1, {}, input)).error);
  assert.equal(state.rows.Expense.length, 0);
});
test("back to details deliberately starts a new equal split", async () => {
  owner(); const data = form("save"); data.set("intent", "edit");
  const result = await ownerExpenseAction(1, {}, data);
  assert.equal(result.input.shares, undefined);
  assert.deepEqual(result.input.participantIds, ["10", "2"]);
  assert.equal(state.rows.Expense.length, 0);
});
