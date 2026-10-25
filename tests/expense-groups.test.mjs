import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { createExpense } = await import("../src/data/expenses.ts");
const { getGroupForOwner } = await import("../src/data/groups.ts");
const { getGroupForGuest } = await import("../src/data/guest-groups.ts");
const { default: OwnerPage } = await import("../src/app/groups/[groupId]/page.tsx");
const { default: GuestPage } = await import("../src/app/g/[shareToken]/group/page.tsx");
const { default: ExpenseList } = await import("../src/components/expenses/expense-list.tsx");
const { default: MemberList } = await import("../src/components/groups/member-list.tsx");
const { default: ActivityList } = await import("../src/components/groups/activity-list.tsx");
const { default: BalanceList } = await import("../src/components/groups/balance-list.tsx");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
beforeEach(reset);
async function setup() {
  state.rows.Group[0].createdAt = "2026-09-01T12:00:00Z";
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true, addedAt: "2026-09-01", claimedAt: "2026-09-01" });
  await setGuestSessionCookie(await claimMember(token, 2));
  await createExpense({ kind: "guest", shareToken: token }, { description: "Lunch", amount: "15.01", paidByMemberId: "10", participantIds: ["2", "10"] });
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
test("owner and guest group services return saved expenses and the creation activity", async () => {
  await setup();
  const owner = await getGroupForOwner(7, 1);
  const guest = await getGroupForGuest(token);
  assert.deepEqual(owner.expenses, guest.expenses);
  assert.deepEqual(owner.balances, guest.balances);
  assert.equal(owner.balances.status, "ready");
  // The guest submitted this expense, but the owner actually paid it.
  assert.equal(owner.balances.members.find(member => member.id === 10).paid, "15.01");
  assert.equal(owner.balances.members.find(member => member.id === 2).paid, "0.00");
  assert.deepEqual(owner.expenses[0], { id: 1, description: "Lunch", amount: "15.01", payerName: "Owner", createdAt: state.rows.Expense[0].createdAt, participantCount: 2, splitMethod: "EQUAL", participants: [{ id: 2, name: "Jaher", amount: "7.51" }, { id: 10, name: "Owner", amount: "7.50" }] });
  assert.ok(guest.activity.some(event => /added "Lunch"/.test(event.description)));
  assert.doesNotMatch(JSON.stringify(guest.expenses), /userId|tokenHash|shareToken|paidByMemberId/);
});
for (const kind of ["owner", "guest"]) test(`${kind} group page displays saved expense details`, async () => {
  await setup();
  const tree = await (kind === "owner" ? OwnerPage({ params: Promise.resolve({ groupId: "1" }) }) : GuestPage({ params: Promise.resolve({ shareToken: token }) }));
  const listNode = nodes(tree).find(node => node.type === ExpenseList);
  assert.ok(listNode);
  const balanceNode = nodes(tree).find(node => node.type === BalanceList);
  assert.ok(balanceNode);
  assert.match(text(BalanceList(balanceNode.props)), /Is owed £7.51/);
  assert.match(text(BalanceList(balanceNode.props)), /Owes £7.51/);
  const list = ExpenseList(listNode.props);
  for (const value of ["Lunch", "£15.01", "Paid by Owner", "2 participants"]) assert.ok(text(list).includes(value), value);
  assert.equal(nodes(list).find(node => node.type === "time").props.dateTime, state.rows.Expense[0].createdAt);
});
test("expense reads stay group-scoped and retain an inactive payer's historical name", async () => {
  await setup();
  state.rows.Expense.push({ ...state.rows.Expense[0], id: 99, groupId: 99, description: "Foreign expense" });
  state.rows.ExpenseParticipant.push({ id: 99, expenseId: 99, memberId: 2, amountOwed: "999.00" });
  state.rows.GroupMember.find(row => row.id === 10).isActive = false;
  const group = await getGroupForGuest(token);
  assert.equal(group.expenses.length, 1); assert.equal(group.expenses[0].payerName, "Owner");
  assert.equal(group.expenses[0].participantCount, 2);
  assert.equal(await getGroupForOwner(99, 1), null);
  state.cookies.clear(); assert.equal(await getGroupForGuest(token), null);
});
test("list is capped at 50 newest expenses with deterministic ID ties", async () => {
  await setup();
  const expense = state.rows.Expense[0];
  state.rows.Expense = Array.from({ length: 55 }, (_, i) => ({ ...expense, id: i + 1 }));
  const shares = state.rows.ExpenseParticipant;
  state.rows.ExpenseParticipant = state.rows.Expense.flatMap(row => shares.map(participant => ({ ...participant, expenseId: row.id })));
  const group = await getGroupForOwner(7, 1);
  assert.equal(group.expenses.length, 50);
  assert.equal(group.balances.expenseCount, 55);
  assert.equal(group.balances.totalPaid, "825.55");
  assert.deepEqual(group.expenses.map(row => row.id), Array.from({ length: 50 }, (_, i) => 55 - i));
});

test("unauthorized owner and token-only guest requests never read balances", async () => {
  await setup();
  state.readOperations = [];
  assert.equal(await getGroupForOwner(99, 1), null);
  state.cookies.clear();
  assert.equal(await getGroupForGuest(token), null);
  assert.equal(await getGroupForGuest("invalid"), null);
  assert.ok(!state.readOperations.includes("Expense.all"));
  assert.ok(!state.readOperations.includes("ExpenseParticipant.all"));
});

test("same guest cookie cannot expose a different group's balances", async () => {
  await setup();
  const otherToken = Buffer.alloc(32, 2).toString("base64url");
  state.rows.Group.push({ ...state.rows.Group[0], id: 99, shareToken: otherToken });
  state.readOperations = [];
  assert.equal(await getGroupForGuest(otherToken), null);
  assert.ok(!state.readOperations.includes("Expense.all"));
});

test("a subsequent saved expense refreshes both balance reads in natural member order", async () => {
  await setup();
  state.rows.GroupMember[0].addedAt = "2026-09-02";
  await createExpense({ kind: "owner", groupId: 1 }, { description: "Return lunch", amount: "7.51", paidByMemberId: "2", participantIds: ["10"] });
  const owner = await getGroupForOwner(7, 1);
  const guest = await getGroupForGuest(token);
  assert.deepEqual(owner.balances, guest.balances);
  assert.equal(owner.balances.totalPaid, "22.52");
  assert.deepEqual(owner.balances.members.map(member => [member.id, member.net]), [[10, "0.00"], [2, "0.00"]]);
});
test("empty list gives a useful first-expense message", () => {
  assert.match(text(ExpenseList({ expenses: [] })), /No expenses yet/);
});
for (const kind of ["owner", "guest"]) test(`${kind} group page presents current identity, strong expense action and shared panels`, async () => {
  await setup();
  state.rows.GroupMember[0].addedAt = "2026-09-02";
  const tree = await (kind === "owner" ? OwnerPage({ params: Promise.resolve({ groupId: "1" }) }) : GuestPage({ params: Promise.resolve({ shareToken: token }) }));
  assert.match(text(tree), kind === "owner" ? /You're here as Owner/ : /You're joined as Jaher/);
  const cta = nodes(tree).find(node => node.props?.href && text(node) === "Add expense");
  assert.ok(cta.props.className.includes("bg-emerald-800"));
  const memberNode = nodes(tree).find(node => node.type === MemberList);
  assert.deepEqual(memberNode.props.members.map(member => member.id), [10, 2]);
  assert.equal(memberNode.props.currentMemberId, kind === "owner" ? 10 : 2);
  const memberTree = MemberList(memberNode.props);
  assert.match(text(memberTree), /\(You\)/);
  assert.match(text(memberTree), /Joined/);
  const activity = nodes(tree).find(node => node.type === ActivityList);
  assert.match(text(ActivityList(activity.props)), /added "Lunch"/);
});
test("expense cards show custom label and persisted split amounts in member order", async () => {
  await setup(); state.rows.GroupMember[0].addedAt = "2026-09-02";
  await createExpense({ kind: "owner", groupId: 1 }, {
    description: "Custom dinner", amount: "10", paidByMemberId: "10", participantIds: ["2", "10"],
    shares: [{ memberId: "2", amount: "3" }, { memberId: "10", amount: "7" }],
  });
  const { expenses } = await getGroupForOwner(7, 1);
  const custom = expenses.find(expense => expense.description === "Custom dinner");
  assert.deepEqual(custom.participants.map(member => [member.id, member.amount]), [[10, "7.00"], [2, "3.00"]]);
  const tree = ExpenseList({ expenses: [custom] });
  for (const expected of ["Custom split", "£10.00", "£7.00", "£3.00", "View split amounts", "2 participants"]) assert.ok(text(tree).includes(expected));
  assert.equal(nodes(tree).filter(node => node.type === "details").length, 1);
});
test("shared member and activity panels have useful empty states and waiting status", () => {
  assert.match(text(MemberList({ members: [] })), /No active members/);
  assert.match(text(MemberList({ members: [{ id: 3, name: "Waiting guest", joined: false }] })), /Waiting/);
  assert.match(text(ActivityList({ activity: [] })), /No activity yet/);
});
