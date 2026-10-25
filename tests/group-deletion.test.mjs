import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token, renderWithState } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { deleteGroupForOwner, GroupDeletionError } = await import("../src/data/group-deletion.ts");
const { deleteGroupAction } = await import("../src/app/actions/group-deletion.ts");
const { getGroupsForOwner } = await import("../src/data/groups.ts");
const { resolveInvite, claimMember } = await import("../src/data/invites.ts");
const { getGuestSessionForGroup } = await import("../src/lib/auth/guest-session.ts");
const { default: Button } = await import("../src/components/groups/delete-group-button.tsx");
const { default: Page } = await import("../src/app/groups/[groupId]/page.tsx");
hooks.deregister();
const hash = createHash("sha256").update(token).digest("hex");
const future = () => new Date(Date.now() + 60000).toISOString();
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : tree == null || typeof tree === "boolean" ? "" : String(tree);
const confirmed = () => { const form = new FormData(); form.set("confirmed", "yes"); return form; };
beforeEach(() => {
  reset();
  state.rows.User = [{ id: 7, name: "Owner" }, { id: 8, name: "Other" }];
  state.rows.UserSession = [{ id: 1, userId: 7, tokenHash: hash, expiresAt: future() }];
  state.cookies.set("splitmate_owner_session", token);
  state.cookies.set("splitmate_guest_session", token);
  state.rows.Group[0].createdAt = "2026-01-01";
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true });
  state.rows.GuestSession = [{ id: 1, groupMemberId: 2, tokenHash: hash, expiresAt: future() }];
  state.rows.Expense = [{ id: 1, groupId: 1, paidByMemberId: 10, amount: "10.00", deletedAt: null }];
  state.rows.ExpenseParticipant = [{ id: 1, expenseId: 1, memberId: 2, amountOwed: "10.00" }];
  state.rows.Payment = [{ id: 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "3.00", status: "CONFIRMED" }];
  state.rows.PaymentAllocation = [{ id: 1, expenseId: 1, paymentId: 1, amountPence: 300n }];
  state.rows.ActivityEvent = [{ id: 1, groupId: 1, memberId: 10, eventType: "GROUP_CREATED", description: "Created", createdAt: "2026-01-01" }];
});

test("deletes complete group, updates totals and invalidates guest credentials and link", async () => {
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "7.00", owing: "0.00" });
  await deleteGroupForOwner(1);
  for (const [model, rows] of Object.entries(state.rows)) if (!["User", "UserSession"].includes(model)) assert.equal(rows.length, 0, model);
  assert.equal(state.rows.User.length, 2); assert.equal(state.rows.UserSession.length, 1);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "0.00", owing: "0.00" });
  assert.equal((await resolveInvite(token)).status, "invalid");
  assert.equal(await getGuestSessionForGroup(1), null);
  await assert.rejects(claimMember(token, 2));
});

test("preserves another group's rows and shared user accounts exactly", async () => {
  const unrelated = {};
  for (const [model, rows] of Object.entries(state.rows)) {
    if (["User", "UserSession"].includes(model)) continue;
    const copies = rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
      ["id", "groupId", "groupMemberId", "memberId", "expenseId", "paymentId", "paidByMemberId", "payerMemberId", "receiverMemberId"].includes(key) ? value + 100 : key === "shareToken" || key === "tokenHash" ? `other-${value}` : value])));
    rows.push(...copies); unrelated[model] = structuredClone(copies);
  }
  const users = structuredClone(state.rows.User); const sessions = structuredClone(state.rows.UserSession);
  await deleteGroupForOwner(1);
  for (const [model, rows] of Object.entries(unrelated)) assert.deepEqual(state.rows[model], rows, model);
  assert.deepEqual(state.rows.User, users); assert.deepEqual(state.rows.UserSession, sessions);
});

for (const mode of ["anonymous", "guest", "nonowner", "expired", "forged role", "missing group"]) test(`rejects ${mode} without cleanup`, async () => {
  if (mode === "anonymous" || mode === "guest") state.cookies.delete("splitmate_owner_session");
  if (mode === "anonymous") state.cookies.clear();
  if (mode === "nonowner" || mode === "forged role") state.rows.UserSession[0].userId = 8;
  if (mode === "forged role") state.rows.GroupMember[1].userId = 8;
  if (mode === "expired") state.rows.UserSession[0].expiresAt = "2000-01-01";
  const before = structuredClone(state.rows);
  await assert.rejects(deleteGroupForOwner(mode === "missing group" ? 99 : 1), GroupDeletionError);
  assert.deepEqual(state.rows, before); assert.equal(state.writes.some(op => op.endsWith("deleteAll")), false);
});

for (const id of [0, -1, 1.5, NaN, Infinity, 2147483648, "1", null]) test(`rejects invalid ID ${id}`, async () => {
  await assert.rejects(deleteGroupForOwner(id), GroupDeletionError); assert.equal(state.reads, 0);
});

test("rechecks session after group lock and does not delete if it was revoked", async () => {
  const get = state.cookies.get.bind(state.cookies); let reads = 0;
  state.cookies.get = name => name === "splitmate_owner_session" && ++reads > 1 ? undefined : get(name);
  const before = structuredClone(state.rows);
  await assert.rejects(deleteGroupForOwner(1), GroupDeletionError);
  assert.ok(state.operations.includes("Group.updateAll"));
  assert.deepEqual(state.rows, before);
});

for (const model of ["GuestSession", "PaymentAllocation", "ExpenseParticipant", "Payment", "Expense", "ActivityEvent", "GroupMember", "Group"]) test(`rolls back all cleanup when ${model} deletion fails`, async () => {
  const before = structuredClone(state.rows); state.failAt = `${model}.deleteAll`;
  await assert.rejects(deleteGroupForOwner(1), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before); assert.equal(state.rollbacks, 1); assert.equal(state.commits, 0);
});

test("includes inactive members, soft deleted expenses, all payment states and disabled non-GBP groups", async () => {
  state.rows.Group[0].currency = "EUR"; state.rows.Group[0].shareLinkEnabled = false;
  state.rows.GroupMember[0].isActive = false; state.rows.Expense[0].deletedAt = "2026-01-01";
  state.rows.Payment.push(...["SENT", "REJECTED"].map((status, i) => ({ ...state.rows.Payment[0], id: i + 2, status })));
  await deleteGroupForOwner(1);
  assert.equal(state.rows.Payment.length + state.rows.Expense.length + state.rows.GroupMember.length, 0);
});

test("empty groups delete and concurrent/repeated requests cannot delete twice", async () => {
  for (const model of Object.keys(state.rows)) if (!["Group", "User", "UserSession"].includes(model)) state.rows[model] = [];
  const results = await Promise.allSettled([deleteGroupForOwner(1), deleteGroupForOwner(1)]);
  assert.equal(results[0].status, "fulfilled"); assert.equal(results[1].status, "rejected");
  assert.equal(state.writes.filter(op => op === "Group.deleteAll").length, 1);
});

test("takes group lock and rechecks authentication before reading dependencies", async () => {
  await deleteGroupForOwner(1);
  const lock = state.operations.indexOf("Group.updateAll");
  const read = state.operations.indexOf("GroupMember.all");
  assert.ok(lock >= 0 && read > lock);
  assert.ok(state.operations.slice(lock + 1, read).includes("UserSession.first"));
});

test("action requires confirmation and refreshes routes only after commit before redirect", async () => {
  assert.match((await deleteGroupAction(1, {}, new FormData())).error, /Confirm/);
  assert.equal(state.commits, 0); assert.deepEqual(state.revalidated, []);
  await assert.rejects(deleteGroupAction(1, {}, confirmed()), { destination: "/dashboard" });
  assert.equal(state.rows.Group.length, 0);
  assert.deepEqual(state.revalidated, ["/groups/1", `/g/${token}`, "/dashboard"]);
});

test("action errors and logs hide database details and do not refresh", async () => {
  state.failAt = "Group.deleteAll"; const logs = []; const original = console.error;
  console.error = message => logs.push(message);
  try { assert.doesNotMatch((await deleteGroupAction(1, {}, confirmed())).error, /PRIVATE_DATABASE_DETAILS/); }
  finally { console.error = original; }
  assert.doesNotMatch(logs.join(), /PRIVATE_DATABASE_DETAILS/); assert.deepEqual(state.revalidated, []);
  assert.equal(state.rows.Group.length, 1);
});

test("owner page includes the named delete control; nonowner page is unavailable", async () => {
  const page = await Page({ params: Promise.resolve({ groupId: "1" }) });
  assert.deepEqual(nodes(page).find(node => node.type === Button).props, { groupId: 1, groupName: "Football" });
  state.rows.UserSession[0].userId = 8;
  await assert.rejects(Page({ params: Promise.resolve({ groupId: "1" }) }), { status: 404 });
});

test("dialog names group, warns about permanent removal, opens safely and restores focus", () => {
  const tree = renderWithState(Button, { groupId: 1, groupName: "Friday Football" });
  const all = nodes(tree); const trigger = all.find(node => node.props.title === "Delete group");
  const dialog = all.find(node => node.type === "dialog"); const cancel = all.find(node => node.type === "button" && text(node) === "Cancel");
  const calls = [];
  trigger.props.ref.current = { focus() { calls.push("trigger focus"); } };
  dialog.props.ref.current = { showModal() { calls.push("open"); }, close() { calls.push("close"); } };
  cancel.props.ref.current = { focus() { calls.push("cancel focus"); } };
  trigger.props.onClick(); cancel.props.onClick(); dialog.props.onClose();
  assert.deepEqual(calls, ["open", "cancel focus", "close", "trigger focus"]);
  assert.match(trigger.props["aria-label"], /Friday Football/);
  assert.match(text(tree), /Delete Friday Football\?/);
  assert.match(text(tree), /permanently.*expenses, repayments.*member access.*cannot be undone/s);
  assert.equal(dialog.props["aria-labelledby"], "delete-group-title");
  assert.equal(state.writes.length, 0);
});

test("pending/error UI blocks cancel, Escape and repeat submissions", () => {
  state.pending = true; state.actionState = { error: "Try again" };
  const all = nodes(renderWithState(Button, { groupId: 1, groupName: "Football" }));
  assert.equal(all.filter(node => node.type === "button" && node.props.disabled).length, 2);
  assert.equal(text(all.find(node => node.props.role === "alert")), "Try again");
  assert.match(text(all.find(node => node.props.role === "status")), /Please wait/);
  let prevented = 0;
  all.find(node => node.type === "dialog").props.onCancel({ preventDefault() { prevented++; } });
  all.find(node => node.type === "form").props.onSubmit({ preventDefault() { prevented++; } });
  assert.equal(prevented, 2);
});

test("rapid second submit is blocked before React pending render and retry unlocks after failure", async () => {
  const all = nodes(renderWithState(Button, { groupId: 1, groupName: "Football" }));
  const form = all.find(node => node.type === "form"); let prevented = 0;
  const event = { preventDefault() { prevented++; } };
  form.props.onSubmit(event); form.props.onSubmit(event); assert.equal(prevented, 1);
  await state.actions[0]({}, new FormData());
  form.props.onSubmit(event); assert.equal(prevented, 1);
});
