import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token, renderWithState } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { createExpense, ExpenseError } = await import("../src/data/expenses.ts");
const { getSavedExpenseForOwner: load, previewSavedExpense: preview, updateSavedExpense: update, deleteSavedExpense: remove } = await import("../src/data/expense-management.ts");
const { getGroupsForOwner, getGroupForOwner } = await import("../src/data/groups.ts");
const { getGroupForGuest } = await import("../src/data/guest-groups.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
const { editExpenseAction, deleteExpenseAction } = await import("../src/app/actions/expense-management.ts");
const { default: Page } = await import("../src/app/groups/[groupId]/expenses/[expenseId]/[operation]/page.tsx");
const { default: Form } = await import("../src/components/expenses/expense-form.tsx");
const { default: Review } = await import("../src/components/expenses/expense-review.tsx");
const { default: DeleteForm } = await import("../src/components/expenses/delete-expense-form.tsx");
const { default: List } = await import("../src/components/expenses/expense-list.tsx");
hooks.deregister();
beforeEach(reset);
const input = () => ({ description: "Dinner", amount: "10.01", paidByMemberId: "10", participantIds: ["2", "10"], shares: [{ memberId: "2", amount: "7.01" }, { memberId: "10", amount: "3.00" }] });
async function setup() {
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true, addedAt: "2026-01-01" });
  await setGuestSessionCookie(await claimMember(token, 2));
  await createExpense({ kind: "guest", shareToken: token }, input(), randomUUID());
  return load(1, 1);
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : tree == null || typeof tree === "boolean" ? "" : String(tree); }
function form(values, intent = "review") {
  const result = new FormData();
  for (const name of ["description", "amount", "paidByMemberId"]) result.set(name, values[name]);
  values.participantIds.forEach(id => result.append("participantIds", id));
  values.shares?.forEach(share => { result.append("shareMemberId", share.memberId); result.append("shareAmount", share.amount); });
  result.set("intent", intent); if (intent === "save") result.set("confirmed", "yes");
  return result;
}
test("owner loads guest-created expense and reviews exact custom allocations without financial writes", async () => {
  const saved = await setup(); const before = structuredClone(state.rows);
  assert.deepEqual(saved.input, input());
  assert.deepEqual((await preview(1, 1, saved.version, saved.input)).input.shares, input().shares);
  assert.deepEqual(state.rows, before);
});
for (const reason of ["anonymous", "guest only", "other owner", "inactive owner", "expired", "cross-group expense", "cross-group target"]) test(`owner reads/updates/deletes reject ${reason}`, async () => {
  const saved = await setup(); let groupId = 1;
  if (reason === "anonymous") state.cookies.clear();
  if (reason === "guest only") state.cookies.delete("splitmate_owner_session");
  if (reason === "other owner") state.rows.Group[0].createdBy = 99;
  if (reason === "inactive owner") state.rows.GroupMember.find(row => row.id === 10).isActive = false;
  if (reason === "expired") state.rows.UserSession[0].expiresAt = "2000-01-01";
  if (reason === "cross-group expense") state.rows.Expense[0].groupId = 99;
  if (reason === "cross-group target") groupId = 99;
  const before = structuredClone(state.rows);
  for (const action of [() => load(groupId, 1), () => preview(groupId, 1, saved.version, input()), () => update(groupId, 1, saved.version, input()), () => remove(groupId, 1, saved.version)]) await assert.rejects(action(), ExpenseError);
  assert.deepEqual(state.rows, before);
});
for (const patch of [{ amount: "0" }, { amount: "1.001" }, { description: " " }, { participantIds: ["2", "2"] }, { paidByMemberId: "99" }, { shares: [{ memberId: "2", amount: "10.01" }] }, { shares: [{ memberId: "2", amount: "-1" }, { memberId: "10", amount: "11.01" }] }]) test(`update rejects invalid ${JSON.stringify(patch)} atomically`, async () => {
  const saved = await setup(); const before = structuredClone(state.rows);
  await assert.rejects(update(1, 1, saved.version, { ...input(), ...patch }), ExpenseError);
  assert.deepEqual(state.rows, before);
});
test("edit changes description, amount, payer and participants while retaining identity/date", async () => {
  const saved = await setup(); const createdAt = state.rows.Expense[0].createdAt;
  const { requestKey, creationDetails } = state.rows.Expense[0];
  const payments = structuredClone(state.rows.Payment);
  await update(1, 1, saved.version, { description: "Revised dinner", amount: "2.01", paidByMemberId: "2", participantIds: ["10"], shares: [{ memberId: "10", amount: "2.01" }] });
  assert.deepEqual(state.rows.Expense[0], { id: 1, groupId: 1, description: "Revised dinner", amount: "2.01", paidByMemberId: 2, splitMethod: "EQUAL", createdAt, requestKey, creationDetails });
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => [row.memberId, row.amountOwed]), [[10, "2.01"]]);
  assert.deepEqual(state.rows.Payment, payments);
  const event = state.rows.ActivityEvent.at(-1);
  assert.equal(event.memberId, 10); assert.equal(event.eventType, "EXPENSE_UPDATED"); assert.equal(event.entityId, 1);
  for (const part of ["Owner", "Revised dinner", "Dinner", "10.01", "2.01", "Jaher"]) assert.ok(event.description.includes(part));
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "0.00", owing: "2.01" });
  assert.ok((await getGroupForGuest(token)).activity.some(row => row.description === event.description));
});
test("changed total/participants retains existing shares, adds zero and exposes exact remainder; reset is deterministic", async () => {
  const saved = await setup();
  state.rows.GroupMember.push({ id: 20, groupId: 1, name: "New", isActive: true });
  const result = await preview(1, 1, saved.version, { ...input(), amount: "11.00", participantIds: ["10", "2", "20"] });
  assert.deepEqual(Object.fromEntries(result.input.shares.map(row => [row.memberId, row.amount])), { 2: "7.01", 10: "3.00", 20: "0.00" });
  const props = { ...result, editing: true, action() {}, pending: false };
  let tree = renderWithState(Review, props);
  assert.match(text(tree), /0.99/); assert.equal(nodes(tree).find(row => row.props.value === "save").props.disabled, true);
  nodes(tree).find(row => row.type === "button" && text(row) === "Reset to equal split").props.onClick();
  tree = renderWithState(Review, props);
  assert.deepEqual(result.review.participants.map(row => [row.id, row.amount]), [[2, "3.67"], [10, "3.67"], [20, "3.66"]]);
  const equal = result.review.participants.map(row => ({ memberId: String(row.id), amount: row.amount }));
  await update(1, 1, saved.version, { ...result.input, shares: equal });
  assert.equal(state.rows.Expense[0].splitMethod, "EQUAL");
});
test("historical inactive participants/payer retained but cannot be newly selected in another role", async () => {
  let saved = await setup();
  await update(1, 1, saved.version, { ...input(), paidByMemberId: "2", participantIds: ["10"], shares: [{ memberId: "10", amount: "10.01" }] });
  state.rows.GroupMember[0].isActive = false;
  saved = await load(1, 1);
  assert.equal(saved.context.members.find(row => row.id === 2).payerEligible, true);
  assert.equal(saved.context.members.find(row => row.id === 2).participantEligible, false);
  await update(1, 1, saved.version, { ...saved.input, description: "Retained inactive payer" });
  saved = await load(1, 1);
  await assert.rejects(update(1, 1, saved.version, { ...saved.input, participantIds: ["2"], shares: [{ memberId: "2", amount: "10.01" }] }), /active/);
});
test("inactive saved shares survive description-only edit; inactive nonmember selections are refused", async () => {
  let saved = await setup(); state.rows.GroupMember[0].isActive = false;
  saved = await load(1, 1);
  await update(1, 1, saved.version, { ...saved.input, description: "New name" });
  assert.deepEqual(state.rows.ExpenseParticipant.map(row => row.amountOwed), ["7.01", "3.00"]);
  saved = await load(1, 1);
  await assert.rejects(update(1, 1, saved.version, { ...saved.input, paidByMemberId: "2" }), /active/);
});
test("delete removes allocations, retains confirmed repayments/audit and repeated delete does not duplicate event", async () => {
  const saved = await setup();
  state.rows.Payment.push({ id: 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "7.01", status: "CONFIRMED" });
  state.rows.PaymentAllocation.push({ id: 1, paymentId: 1, expenseId: 1, amountPence: 701n });
  await remove(1, 1, saved.version); await remove(1, 1, saved.version);
  assert.ok(state.rows.Expense[0].deletedAt); assert.equal(state.rows.ExpenseParticipant.length, 2); assert.equal(state.rows.Payment.length, 1);
  const events = state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_DELETED");
  assert.equal(events.length, 1); assert.match(events[0].description, /Owner.*Dinner.*10.01/);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "0.00", owing: "0.00" });
  assert.ok((await getGroupForGuest(token)).activity.some(row => row.description === events[0].description));
  await assert.rejects(update(1, 1, saved.version, input()), /deleted/);
});
test("stale and duplicate edits and stale delete cannot overwrite, even after values are restored", async () => {
  const original = await setup();
  await update(1, 1, original.version, { ...input(), description: "Changed" });
  await assert.rejects(update(1, 1, original.version, input()), /changed/);
  await assert.rejects(remove(1, 1, original.version), /changed/);
  const newer = await load(1, 1); await update(1, 1, newer.version, input());
  await assert.rejects(update(1, 1, original.version, input()), /changed/);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_UPDATED").length, 2);
});
for (const first of ["edit", "delete"]) test(`serialized ${first}-first concurrent edit/delete has one winner`, async () => {
  const saved = await setup();
  const edit = () => update(1, 1, saved.version, { ...input(), description: "Winner" });
  const del = () => remove(1, 1, saved.version);
  const results = await Promise.allSettled(first === "edit" ? [edit(), del()] : [del(), edit()]);
  assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
  assert.equal(state.rows.ActivityEvent.filter(row => ["EXPENSE_UPDATED", "EXPENSE_DELETED"].includes(row.eventType)).length, 1);
});
for (const operation of ["Expense.updateAll", "ExpenseParticipant.delete", "ExpenseParticipant.create", "ActivityEvent.create", "Expense.delete"]) test(`failure at ${operation} rolls back changes and shares`, async () => {
  const saved = await setup(); const before = structuredClone(state.rows); state.failAt = operation === "Expense.delete" ? "Expense.updateAll" : operation;
  await assert.rejects(operation === "Expense.delete" ? remove(1, 1, saved.version) : update(1, 1, saved.version, input()), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
test("complete-ledger dashboard includes edit/delete of expense outside newest 50", async () => {
  const saved = await setup();
  for (let i = 2; i <= 56; i++) {
    state.rows.Expense.push({ ...state.rows.Expense[0], id: i });
    state.rows.ExpenseParticipant.push({ id: i * 10, expenseId: i, memberId: 2, amountOwed: "10.01" });
  }
  assert.equal((await getGroupForOwner(7, 1)).expenses.some(row => row.id === 1), false);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "557.56", owing: "0.00" });
  await update(1, 1, saved.version, { ...input(), shares: [{ memberId: "2", amount: "0.00" }, { memberId: "10", amount: "10.01" }] });
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "550.55", owing: "0.00" });
  await remove(1, 1, (await load(1, 1)).version);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "550.55", owing: "0.00" });
});
test("actions retain edited raw shares across Back/edit/review and safe errors", async () => {
  const saved = await setup(); const action = editExpenseAction.bind(null, 1, 1, saved.version);
  const values = { ...input(), shares: [{ memberId: "2", amount: "bad" }, { memberId: "10", amount: "3.00" }] };
  const back = await action({}, form(values, "edit")); assert.deepEqual(back.input.shares, values.shares);
  const failed = await action({}, form(values, "save")); assert.ok(failed.error); assert.deepEqual(failed.input.shares, values.shares); assert.ok(failed.review);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "EXPENSE_UPDATED").length, 0);
});
for (const operation of ["edit", "delete"]) test(`${operation} action refreshes owner/guest/dashboard only after commit`, async () => {
  const saved = await setup();
  const data = form(input(), "save");
  const action = operation === "edit" ? editExpenseAction : deleteExpenseAction;
  await assert.rejects(action(1, 1, saved.version, {}, data), { destination: `/groups/1?expense=${operation === "edit" ? "updated" : "deleted"}` });
  assert.deepEqual(state.revalidated, ["/groups/1", `/g/${token}/group`, "/dashboard"]);
});
test("delete requires confirmation and errors disclose no database detail", async () => {
  const saved = await setup(); const before = structuredClone(state.rows);
  assert.match((await deleteExpenseAction(1, 1, saved.version, {}, new FormData())).error, /Confirm/);
  state.failAt = "Expense.updateAll"; const data = new FormData(); data.set("confirmed", "yes");
  const old = console.error; const logs = []; console.error = value => logs.push(value);
  try { assert.doesNotMatch((await deleteExpenseAction(1, 1, saved.version, {}, data)).error, /PRIVATE/); } finally { console.error = old; }
  assert.doesNotMatch(logs.join(), /PRIVATE/); assert.deepEqual(state.rows, before); assert.deepEqual(state.revalidated, []);
});
test("owner links, edit prefill, delete explanation and cancel navigation are present without writes", async () => {
  await setup(); const before = structuredClone(state.rows);
  const group = await getGroupForOwner(7, 1);
  assert.equal(nodes(List({ expenses: group.expenses })).filter(row => row.props.href).length, 0);
  assert.deepEqual(nodes(List({ expenses: group.expenses, ownerGroupId: 1 })).filter(row => row.props.href).map(row => row.props.href), ["/groups/1/expenses/1/edit", "/groups/1/expenses/1/delete"]);
  const edit = await Page({ params: Promise.resolve({ groupId: "1", expenseId: "1", operation: "edit" }) });
  const formNode = nodes(edit).find(row => row.type === Form); assert.deepEqual(formNode.props.initialInput, input());
  state.actionState = { input: formNode.props.initialInput };
  const fields = Form(formNode.props); assert.equal(nodes(fields).find(row => row.props.name === "description").props.defaultValue, "Dinner");
  assert.deepEqual(nodes(fields).filter(row => row.props.name === "shareAmount").map(row => row.props.value), ["7.01", "3.00"]);
  const del = await Page({ params: Promise.resolve({ groupId: "1", expenseId: "1", operation: "delete" }) });
  assert.match(text(del), /Dinner.*10.01.*from balances.*linked.*excluded/s);
  assert.equal(nodes(del).find(row => text(row) === "Cancel and return to group").props.href, "/groups/1");
  assert.deepEqual(state.rows, before);
});
test("delete pending/error UI is accessible and prevents repeat activation", () => {
  state.pending = true; state.actionState = { error: "Try again" };
  const tree = DeleteForm({ action() {} });
  assert.equal(nodes(tree).find(row => row.type === "button").props.disabled, true);
  assert.equal(text(nodes(tree).find(row => row.props.role === "alert")), "Try again");
});

for (const role of ["payer", "participant"]) test(`edit rejects a real cross-group ${role}`, async () => {
  const saved = await setup();
  state.rows.GroupMember.push({ id: 99, groupId: 99, name: "Foreign", isActive: true });
  const patch = role === "payer" ? { paidByMemberId: "99" } : { participantIds: ["99"], shares: [{ memberId: "99", amount: "10.01" }] };
  const before = structuredClone(state.rows);
  await assert.rejects(update(1, 1, saved.version, { ...input(), ...patch }), ExpenseError);
  assert.deepEqual(state.rows, before);
});
test("reads, edit and delete take the financial group lock before saved rows and recheck owner authentication", async () => {
  const saved = await setup();
  for (const action of [() => load(1, 1), () => update(1, 1, saved.version, input()), async () => remove(1, 1, (await load(1, 1)).version)]) {
    state.operations = []; await action();
    const lock = state.operations.indexOf("Group.updateAll");
    const read = state.operations.indexOf("Expense.first");
    assert.ok(lock >= 0 && read > lock);
    assert.ok(state.operations.slice(lock + 1, read).includes("UserSession.first"));
  }
});
test("pending and rejected repayments survive edit/delete without contributing to balances", async () => {
  const saved = await setup();
  state.rows.Payment = ["SENT", "REJECTED"].map((status, i) => ({ id: i + 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "3.00", status }));
  state.rows.PaymentAllocation = state.rows.Payment.map(payment => ({ id: payment.id, paymentId: payment.id, expenseId: 1, amountPence: 300n }));
  const payments = structuredClone(state.rows.Payment);
  await update(1, 1, saved.version, { ...input(), description: "Revised" });
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "7.01", owing: "0.00" });
  await remove(1, 1, (await load(1, 1)).version);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "0.00", owing: "0.00" });
  assert.deepEqual(state.rows.Payment, payments);
});
test("route refresh remounts an edit draft when its saved version changes", async () => {
  const saved = await setup();
  const params = Promise.resolve({ groupId: "1", expenseId: "1", operation: "edit" });
  const before = nodes(await Page({ params })).find(row => row.type === Form).key;
  await update(1, 1, saved.version, { ...input(), description: "Updated elsewhere" });
  const after = nodes(await Page({ params })).find(row => row.type === Form).key;
  assert.notEqual(before, after, "a stale draft must not be paired with a newly bound version");
});

test("original creation retry after a real edit returns original ID without overwriting the edit", async () => {
  const saved = await setup(); const key = state.rows.Expense[0].requestKey;
  const originalSnapshot = state.rows.Expense[0].creationDetails;
  const changed = { description: "Revised", amount: "2.01", paidByMemberId: "2", participantIds: ["10"], shares: [{ memberId: "10", amount: "2.01" }] };
  await update(1, 1, saved.version, changed);
  const before = structuredClone(state.rows);
  assert.deepEqual(await createExpense({ kind: "guest", shareToken: token }, input(), key), { id: 1, groupId: 1 });
  assert.deepEqual(state.rows, before);
  assert.equal(state.rows.Expense[0].creationDetails, originalSnapshot);
  await assert.rejects(createExpense({ kind: "guest", shareToken: token }, changed, key), /different expense details/);
  assert.deepEqual(state.rows, before);
});
test("original retry after deletion retains tombstone and excluded payment allocations", async () => {
  const saved = await setup(); const key = state.rows.Expense[0].requestKey;
  state.rows.Payment.push({ id: 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "1.00", status: "CONFIRMED", createdAt: "2026-01-01" });
  state.rows.PaymentAllocation.push({ id: 1, paymentId: 1, expenseId: 1, amountPence: 100n });
  await remove(1, 1, saved.version);
  const before = structuredClone(state.rows);
  assert.ok(state.rows.Expense[0].deletedAt);
  assert.deepEqual(await createExpense({ kind: "guest", shareToken: token }, input(), key), { id: 1, groupId: 1 });
  assert.deepEqual(state.rows, before);
  assert.equal((await getGroupForOwner(7, 1)).expenses.length, 0);
  assert.ok(state.rows.ActivityEvent.some(row => row.eventType === "PAYMENT_ALLOCATION_EXCLUDED"));
});
