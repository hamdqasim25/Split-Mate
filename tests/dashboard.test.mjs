import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";
import ts from "typescript";

// A query double evaluates projections, ordering, limits and the ledger lock protocol.
// Import interception ensures these tests cannot reach the cloud database.
const mockUrl = `data:text/javascript,${encodeURIComponent(`
export const state = { rows: {}, reads: [], user: null, failure: null };
export async function getCurrentUser() { return state.user; }
export async function signOut() { throw new Error('Unexpected sign-out in page rendering test'); }
export function redirect(destination) { throw Object.assign(new Error('redirect'), { destination }); }
export default function Link() {}
const fields = new Proxy({}, { get: (_, key) => ({
  in: values => row => values.includes(row[key]),
  desc: () => ({ key, direction: -1 }),
  asc: () => ({ key, direction: 1 }),
}) });
function collection(model, options = {}) {
  const next = patch => collection(model, { ...options, ...patch });
  return {
    where(filter) {
      const predicate = typeof filter === 'function' ? filter(fields)
        : row => Object.entries(filter).every(([key, value]) => row[key] === value);
      return next({ filters: [...(options.filters ?? []), predicate] });
    },
    select(...selection) { return next({ selection }); },
    include(relation, refine) {
      if (model !== 'Group' || relation !== 'members') throw new Error('Unexpected relation');
      return next({ memberCount: refine(collection('GroupMember')) });
    },
    count() { return { filters: options.filters ?? [] }; },
    orderBy(callbacks) { return next({ order: callbacks.map(callback => callback(fields)) }); },
    limit(limit) { return next({ limit }); },
    async updateAll(values) {
      assertLock();
      const rows = state.rows[model].filter(row => (options.filters ?? []).every(predicate => predicate(row)));
      state.locks.push(...rows.map(row => row.id));
      return rows.map(row => { Object.assign(row, values); return { id: row.id }; });
    },
    async all() {
      state.reads.push({ model, ...options });
      if (state.failure) throw state.failure;
      if (model === state.failModel) throw new Error("private database details");
      if (["Expense", "ExpenseParticipant", "Payment"].includes(model)) assertLock();
      let rows = state.rows[model].filter(row => (options.filters ?? []).every(predicate => predicate(row)));
      rows.sort((a, b) => {
        for (const { key, direction } of options.order ?? []) {
          const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
          if (comparison) return direction * comparison;
        }
        return 0;
      });
      if (options.limit !== undefined) rows = rows.slice(0, options.limit);
      return rows.map(row => ({
        ...Object.fromEntries((options.selection ?? Object.keys(row)).map(key => [key, row[key]])),
        ...(options.memberCount && { members: state.rows.GroupMember.filter(member =>
          member.groupId === row.id && options.memberCount.filters.every(predicate => predicate(member))).length }),
      }));
    },
  };
}
function assertLock() { if (!state.inTransaction) throw new Error('Ledger read outside transaction'); }
export const db = {
  orm: { public: Object.fromEntries(['Group', 'GroupMember', 'ActivityEvent', 'Expense', 'ExpenseParticipant', 'Payment', 'PaymentAllocation'].map(model => [model, collection(model)])) },
  async transaction(fn) {
    if (state.inTransaction) throw new Error('Parallel or nested transaction');
    state.inTransaction = true;
    try { return await fn(db); } finally { state.inTransaction = false; }
  },
};
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (["@/prisma/db", "@/lib/auth/session", "@/app/actions/auth", "next/navigation", "next/link"].includes(specifier)) {
      return { url: mockUrl, shortCircuit: true };
    }
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier.startsWith("@/")) return { url: new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { state } = await import(mockUrl);
const { getGroupsForOwner } = await import("../src/data/groups.ts");
const { default: Dashboard } = await import("../src/app/dashboard/page.tsx");
hooks.deregister();

beforeEach(() => {
  state.reads = [];
  state.locks = [];
  state.inTransaction = false;
  state.failModel = null;
  state.user = { id: 7, name: "Test Owner" };
  state.failure = null;
  state.rows = {
    Expense: [], ExpenseParticipant: [], Payment: [], PaymentAllocation: [],
    Group: [
      { id: 1, createdBy: 7, name: "Older group", description: null, currency: "GBP", createdAt: "2026-09-01T12:00:00Z", shareToken: "secret-token" },
      { id: 2, createdBy: 7, name: "Newest group", description: "A real description", currency: "GBP", createdAt: "2026-09-02T12:00:00Z", shareToken: "secret-token" },
      { id: 3, createdBy: 9, name: "Other owner's group", description: null, currency: "GBP", createdAt: "2026-09-03T12:00:00Z", shareToken: "other-secret" },
    ],
    GroupMember: [
      { groupId: 1, userId: 7, isActive: true },
      { groupId: 1, userId: null, isActive: true },
      { groupId: 1, userId: null, isActive: false },
      { groupId: 3, userId: 7, isActive: true },
    ],
    ActivityEvent: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1, groupId: index === 7 ? 3 : index % 2 + 1,
      description: index === 7 ? "Other owner's private event" : "Test Owner created the group",
      createdAt: `2026-09-0${index + 1}T12:00:00Z`, memberId: 100, entityType: "GROUP",
    })),
  };
});

for (const id of [0, -1, 1.5, NaN, Infinity, 2_147_483_648, "7", null, undefined]) {
  test(`rejects invalid owner ID ${String(id)} before querying`, async () => {
    await assert.rejects(getGroupsForOwner(id), RangeError);
    assert.equal(state.reads.length, 0);
  });
}
test("only owned groups and their newest five events are returned", async () => {
  const { groups, activity } = await getGroupsForOwner(7);
  assert.deepEqual(groups.map(group => group.id), [2, 1]);
  assert.deepEqual(activity.map(event => event.id), [7, 6, 5, 4, 3]);
  assert.ok(activity.every(event => [1, 2].includes(event.groupId)));
  assert.deepEqual(state.locks, [2, 1]);
  assert.equal(state.reads[1].limit, 5);
});
test("counts only active members, including guests, and returns zero for an empty group", async () => {
  const { groups } = await getGroupsForOwner(7);
  assert.deepEqual(groups.map(group => group.members), [0, 2]);
});
test("selects only dashboard fields and never returns share tokens or identity secrets", async () => {
  const result = await getGroupsForOwner(7);
  assert.deepEqual(Object.keys(result.groups[0]).sort(), ["createdAt", "currency", "description", "id", "members", "name", "ownerNet"]);
  assert.deepEqual(Object.keys(result.activity[0]).sort(), ["createdAt", "description", "groupId", "id"]);
  assert.doesNotMatch(JSON.stringify(result), /secret|shareToken|password|userId|memberId/);
});
test("uses IDs to break timestamp ties deterministically", async () => {
  state.rows.Group[0].createdAt = state.rows.Group[1].createdAt;
  state.rows.ActivityEvent.forEach(event => { event.createdAt = "2026-09-01T12:00:00Z"; });
  const result = await getGroupsForOwner(7);
  assert.deepEqual(result.groups.map(group => group.id), [2, 1]);
  assert.deepEqual(result.activity.map(event => event.id), [7, 6, 5, 4, 3]);
});
test("no owned groups skips the activity query", async () => {
  assert.deepEqual(await getGroupsForOwner(88), { groups: [], activity: [], totals: { owed: "0.00", owing: "0.00" } });
  assert.equal(state.reads.length, 1);
});
test("database failures propagate rather than pretending the dashboard is empty", async () => {
  state.failure = new Error("Database unavailable");
  await assert.rejects(getGroupsForOwner(7), state.failure);
});
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
test("unauthenticated dashboard redirects without any group queries", async () => {
  state.user = null;
  await assert.rejects(Dashboard(), { destination: "/login?next=/dashboard" });
  assert.equal(state.reads.length, 0);
});
test("dashboard uses the verified owner, renders real data and removes sample money", async () => {
  const output = text(await Dashboard());
  assert.match(output, /Welcome back,\s*Test Owner/);
  assert.match(output, /Newest group/);
  assert.match(output, /A real description/);
  assert.match(output, /Test Owner created the group/);
  assert.match(output, /Across your groups/);
  assert.match(output, /Totals unavailable/);
  assert.doesNotMatch(output, /Weekend Trip|Football|£40|£12|View all|Other owner's|secret-token/);
  state.user = { id: 9, name: "Another Owner" };
  const otherOutput = text(await Dashboard());
  assert.match(otherOutput, /Other owner's group/);
  assert.doesNotMatch(otherOutput, /Newest group/);
});
test("dashboard renders useful empty states", async () => {
  state.user = { id: 88, name: "New Owner" };
  const output = text(await Dashboard());
  assert.match(output, /No groups yet/);
  assert.match(output, /Create your first group/);
  assert.match(output, /No activity yet/);
  assert.equal((output.match(/£0\.00/g) ?? []).length, 2);
});

function memberships() {
  state.rows.GroupMember = state.rows.Group.flatMap(group => [
    { id: group.id * 10, groupId: group.id, userId: group.createdBy, role: "OWNER", name: "Same name", isActive: true },
    { id: group.id * 10 + 1, groupId: group.id, userId: null, role: "MEMBER", name: "Same name", isActive: true },
  ]);
}
function expense(groupId, amount, negative = false) {
  const id = state.rows.Expense.length + 1;
  state.rows.Expense.push({ id, groupId, amount, paidByMemberId: groupId * 10 + Number(negative) });
  state.rows.ExpenseParticipant.push({ expenseId: id, memberId: groupId * 10 + Number(!negative), amountOwed: amount });
}
function payment(groupId, amount, status, outgoing = false) {
  state.rows.Payment.push({ id: state.rows.Payment.length + 1, groupId, amount, status,
    payerMemberId: groupId * 10 + Number(!outgoing), receiverMemberId: groupId * 10 + Number(outgoing) });
  state.rows.PaymentAllocation.push({ paymentId: state.rows.Payment.at(-1).id, expenseId: state.rows.Expense.filter(row => row.groupId === groupId).at(-1).id, amountPence: BigInt(amount.replace(".", "")) });
}

test("valid empty ledgers show zero totals and Even cards", async () => {
  memberships();
  const result = await getGroupsForOwner(7);
  assert.deepEqual(result.totals, { owed: "0.00", owing: "0.00" });
  assert.deepEqual(result.groups.map(group => group.ownerNet), ["0.00", "0.00"]);
  assert.match(text(await Dashboard()), /Even/);
});

test("positive and negative owner balances remain separate across groups and cards", async () => {
  state.rows.Group.push({ ...state.rows.Group[0], id: 4, name: "Third owned group" });
  memberships();
  expense(1, "20.00"); expense(2, "5.00", true); expense(4, "10.00");
  expense(3, "999.99"); // Another owner's ledger must never affect these totals.
  const result = await getGroupsForOwner(7);
  assert.deepEqual(result.totals, { owed: "30.00", owing: "5.00" });
  assert.equal((await getGroupsForOwner(9)).totals.owed, "999.99");
  const output = text(await Dashboard());
  for (const label of ["You are owed £20.00", "You owe £5.00", "You are owed £10.00", "£30.00"]) assert.ok(output.includes(label));
  assert.doesNotMatch(output, /999.99/);
});

test("only confirmed repayments reduce the owner's positive and negative balances", async () => {
  memberships(); expense(1, "10.01"); expense(2, "6.03", true);
  payment(1, "2.00", "SENT"); payment(2, "1.00", "REJECTED", true);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "10.01", owing: "6.03" });
  payment(1, "3.00", "CONFIRMED"); payment(2, "2.02", "CONFIRMED", true);
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "7.01", owing: "4.01" });
});

test("fully repaid groups show Even without removing expenses or history", async () => {
  memberships(); expense(1, "10.01"); payment(1, "10.01", "CONFIRMED");
  const result = await getGroupsForOwner(7);
  assert.deepEqual(result.totals, { owed: "0.00", owing: "0.00" });
  assert.equal(result.groups.find(group => group.id === 1).ownerNet, "0.00");
  assert.equal((text(await Dashboard()).match(/Even/g) ?? []).length, 2);
});

test("complete expense and payment histories exceed display limits", async () => {
  memberships();
  for (let i = 0; i < 61; i++) { expense(1, "1.01"); payment(1, "0.01", "CONFIRMED"); }
  assert.deepEqual((await getGroupsForOwner(7)).totals, { owed: "61.00", owing: "0.00" });
  assert.ok(state.reads.filter(read => ["Expense", "Payment"].includes(read.model)).every(read => read.limit === undefined));
});

test("large aggregate balances retain pennies beyond Number precision and input limits", async () => {
  memberships();
  // Each record is within the existing decimal bound; the total is not.
  for (let i = 0; i < 90073; i++) expense(1, "999999999.99");
  expense(2, "0.01");
  const result = await getGroupsForOwner(7);
  assert.equal(result.totals.owed, "90072999999099.28");
  assert.equal(result.groups.find(group => group.id === 1).ownerNet, "90072999999099.27");
});

for (const problem of ["missing owner", "wrong user", "wrong role", "inactive owner", "duplicate owner", "invalid ledger", "unsupported currency", "read failure"]) {
  test(`${problem} makes totals unavailable without hiding valid group balances`, async () => {
    memberships(); expense(1, "20.00"); expense(2, "5.00");
    const owner = state.rows.GroupMember.find(member => member.id === 20);
    if (problem === "missing owner") state.rows.GroupMember = state.rows.GroupMember.filter(member => member !== owner);
    if (problem === "wrong user") owner.userId = 9;
    if (problem === "wrong role") owner.role = "MEMBER";
    if (problem === "inactive owner") owner.isActive = false;
    if (problem === "duplicate owner") state.rows.GroupMember.push({ ...owner, id: 99 });
    if (problem === "invalid ledger") state.rows.ExpenseParticipant.find(share => share.expenseId === 2).amountOwed = "4.99";
    if (problem === "unsupported currency") state.rows.Group[1].currency = "USD";
    if (problem === "read failure") state.failModel = "Payment";
    const result = await getGroupsForOwner(7);
    assert.equal(result.totals, null);
    assert.equal(result.groups.find(group => group.id === 2).ownerNet, null);
    if (problem !== "read failure") assert.equal(result.groups.find(group => group.id === 1).ownerNet, "20.00");
    const output = text(await Dashboard());
    assert.match(output, /Totals unavailable/);
    assert.match(output, /Balance unavailable/);
    assert.doesNotMatch(output, /private database details/);
  });
}
