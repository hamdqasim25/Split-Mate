import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { db, installHooks, reset, state } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { calculateBalances, getBalancesForGroup } = await import("../src/data/balances.ts");
const { default: BalanceList } = await import("../src/components/groups/balance-list.tsx");
hooks.deregister();
beforeEach(reset);
const members = [
  { id: 1, name: "Payer", isActive: true },
  { id: 2, name: "Guest", isActive: true },
  { id: 3, name: "Other", isActive: true },
];
const expense = (id, amount, paidByMemberId = 1) => ({ id, amount, paidByMemberId });
const share = (expenseId, memberId, amountOwed) => ({ expenseId, memberId, amountOwed });
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function assertBalanced(result) {
  assert.equal(result.status, "ready");
  assert.equal(result.totalPaid, result.totalShare);
  assert.equal(result.members.reduce((sum, member) => sum + BigInt(member.net.replace(".", "")), 0n), 0n);
}
test("empty ledger includes active zero balances in supplied order", () => {
  const result = calculateBalances(members, [], []);
  assertBalanced(result);
  assert.deepEqual(result.members.map(row => [row.id, row.paid, row.share, row.net]), members.map(row => [row.id, "0.00", "0.00", "0.00"]));
  assert.match(text(BalanceList({ balances: result })), /No expenses yet.*Even/);
});
test("equal remainder pennies remain exact and labels distinguish owed, owes and even", () => {
  const result = calculateBalances(members, [expense(1, "10.01")], [share(1, 1, "5.01"), share(1, 2, "5.00")]);
  assertBalanced(result);
  assert.deepEqual(result.members.map(row => row.net), ["5.00", "-5.00", "0.00"]);
  const rendered = text(BalanceList({ balances: result }));
  for (const label of ["Is owed £5.00", "Owes £5.00", "Even", "Balances include confirmed payments only"]) assert.ok(rendered.includes(label));
});
test("custom zero shares, different payers and nonparticipant payer reconcile", () => {
  const result = calculateBalances(members, [expense(1, "10.01"), expense(2, "4.25", 2)], [share(1, 2, "10.01"), share(1, 3, "0.00"), share(2, 1, "4.25")]);
  assertBalanced(result);
  assert.deepEqual(result.members.map(row => [row.paid, row.share, row.net]), [["10.01", "4.25", "5.76"], ["4.25", "10.01", "-5.76"], ["0.00", "0.00", "0.00"]]);
});
test("inactive historical payers and zero-share participants remain; unused inactive members do not", () => {
  const result = calculateBalances([...members.map(row => ({ ...row, isActive: false })), { id: 4, name: "Unused", isActive: false }], [expense(1, "1.00")], [share(1, 2, "1.00"), share(1, 3, "0.00")]);
  assertBalanced(result);
  assert.deepEqual(result.members.map(row => row.id), [1, 2, 3]);
  assert.match(text(BalanceList({ balances: result })), /Inactive member/);
});
test("aggregate pence safely exceed Number.MAX_SAFE_INTEGER and single expense maximum", () => {
  const expenses = Array.from({ length: 100001 }, (_, i) => expense(i, "999999999.99"));
  const result = calculateBalances(members, expenses, expenses.map(row => share(row.id, 2, row.amount)));
  assertBalanced(result);
  assert.equal(result.totalPaid, "100000999998999.99");
  assert.equal(result.members[1].net, "-100000999998999.99");
});
for (const [name, expenses, shares] of [
  ["missing shares", [expense(1, "1.00")], []],
  ["offsetting per-expense mismatches", [expense(1, "1.00"), expense(2, "1.00")], [share(1, 1, "0.50"), share(2, 1, "1.50")]],
  ["duplicate participants", [expense(1, "1.00")], [share(1, 1, "0.50"), share(1, 1, "0.50")]],
  ["foreign payer", [expense(1, "1.00", 99)], [share(1, 1, "1.00")]],
  ["foreign participant", [expense(1, "1.00")], [share(1, 99, "1.00")]],
  ["foreign expense share", [expense(1, "1.00")], [share(99, 1, "1.00")]],
  ["duplicate expense", [expense(1, "1.00"), expense(1, "1.00")], [share(1, 1, "1.00")]],
  ["negative share", [expense(1, "1.00")], [share(1, 1, "-1.00")]],
  ["fractional penny", [expense(1, "1.001")], [share(1, 1, "1.001")]],
]) test(`inconsistent ledger is unavailable: ${name}`, () => {
  const balances = calculateBalances(members, expenses, shares);
  assert.deepEqual(balances, { status: "unavailable" });
  assert.match(text(BalanceList({ balances })), /Balances unavailable/);
  assert.doesNotMatch(text(BalanceList({ balances })), /Is owed|Owes £|Even/);
});
function seed(count) {
  state.rows.Expense = Array.from({ length: count }, (_, i) => ({ ...expense(i + 1, "0.01", 2), groupId: 1 }));
  state.rows.ExpenseParticipant = state.rows.Expense.map(row => share(row.id, 2, row.amount));
}
test("full ledger exceeds 50; queries batch by expenses, never by member", async () => {
  seed(1001);
  const result = await getBalancesForGroup(1);
  assertBalanced(result);
  assert.equal(result.expenseCount, 1001);
  assert.equal(result.totalPaid, "10.01");
  assert.equal(state.readOperations.filter(op => op === "ExpenseParticipant.all").length, 3);
  assert.equal(state.readOperations.filter(op => op === "GroupMember.all").length, 1);
});
test("concurrent insertion after expense capture cannot mix shares into that snapshot", async () => {
  seed(1);
  const client = { orm: { public: { ...db.orm.public, Expense: {
    where(filter) { return { select(...fields) { return { async all() {
      const captured = await db.orm.public.Expense.where(filter).select(...fields).all();
      state.rows.Expense.push({ ...expense(2, "5.00", 2), groupId: 1 });
      state.rows.ExpenseParticipant.push(share(2, 2, "5.00"));
      return captured;
    } }; } }; },
  } } } };
  const result = await getBalancesForGroup(1, client);
  assertBalanced(result);
  assert.equal(result.totalPaid, "0.01");
  assert.equal((await getBalancesForGroup(1)).totalPaid, "5.01");
});
test("read remains group-scoped and rejects unsupported currency", async () => {
  seed(1);
  state.rows.Expense.push({ ...expense(99, "99.00", 2), groupId: 99 });
  state.rows.ExpenseParticipant.push(share(99, 2, "99.00"));
  assert.equal((await getBalancesForGroup(1)).totalPaid, "0.01");
  state.rows.Group[0].currency = "USD";
  assert.deepEqual(await getBalancesForGroup(1), { status: "unavailable" });
});
