import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token, renderWithState } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { createExpense } = await import("../src/data/expenses.ts");
const { createPayment, reviewPayment, reconcilePayment, getPaymentReconciliation } = await import("../src/data/payments.ts");
const { getLedgerForGroup } = await import("../src/data/balances.ts");
const { getGroupsForOwner, getGroupForOwner } = await import("../src/data/groups.ts");
const { getGroupForGuest } = await import("../src/data/guest-groups.ts");
const { getSavedExpenseForOwner, deleteSavedExpense, updateSavedExpense } = await import("../src/data/expense-management.ts");
const { effectivePaymentPence, pendingPaymentPence } = await import("../src/lib/payments/allocations.ts");
const { canConfirmPayment } = await import("../src/lib/payments/eligibility.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
const { reconcilePaymentAction } = await import("../src/app/actions/payments.ts");
const { default: AllocationFields } = await import("../src/components/groups/payment-allocation-fields.tsx");
const { default: PaymentPanel, PaymentReview } = await import("../src/components/groups/payment-panel.tsx");
const { default: BalanceList } = await import("../src/components/groups/balance-list.tsx");
const { default: ReconcilePage } = await import("../src/app/groups/[groupId]/payments/[paymentId]/reconcile/page.tsx");
hooks.deregister();
const owner = { kind: "owner", groupId: 1 }, guest = { kind: "guest", shareToken: token };
beforeEach(async () => {
  reset();
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true });
  await setGuestSessionCookie(await claimMember(token, 2));
  await expense("20.00");
});
const expense = (amount, description = "Court") => createExpense(owner, { description, amount, paidByMemberId: "10", participantIds: ["2"] });
const proposal = (amount = "20.00", allocations = [{ expenseId: "1", amount }]) => ({ payerMemberId: "2", receiverMemberId: "10", amount, allocations, requestKey: randomUUID() });
async function report(amount = "20.00", allocations) { const input = proposal(amount, allocations); delete input.payerMemberId; return createPayment(guest, input); }
const payment = async (id = 1) => (await getLedgerForGroup(1)).payments.find(row => row.id === id);
async function remove(id = 1) { return deleteSavedExpense(1, id, (await getSavedExpenseForOwner(1, id)).version); }
const totals = () => getGroupsForOwner(7).then(row => row.totals);
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join("") : tree && typeof tree === "object" ? text(tree.props?.children) : tree == null || typeof tree === "boolean" ? "" : String(tree); }

for (const amount of ["20.00", "7.01"]) test(`deleting an expense paid ${amount} excludes its payment without suggesting a refund`, async () => {
  await createPayment(owner, proposal(amount));
  const original = structuredClone(state.rows.Payment);
  const saved = await getSavedExpenseForOwner(1, 1);
  await deleteSavedExpense(1, 1, saved.version); await deleteSavedExpense(1, 1, saved.version);
  assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
  assert.deepEqual(state.rows.Payment, original);
  assert.equal(effectivePaymentPence(await payment()), 0n);
  assert.equal((await getGroupForOwner(7, 1)).expenses.length, 0);
  assert.equal(state.rows.ExpenseParticipant.length, 1, "audit shares retained");
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "PAYMENT_ALLOCATION_EXCLUDED").length, 1);
});
test("a multi-expense payment loses only the deleted expense's allocation", async () => {
  await expense("10.00", "Dinner");
  await createPayment(owner, proposal("25.00", [{ expenseId: "1", amount: "20.00" }, { expenseId: "2", amount: "5.00" }]));
  await remove(1);
  assert.equal(effectivePaymentPence(await payment()), 500n);
  assert.deepEqual(await totals(), { owed: "5.00", owing: "0.00" });
  assert.equal((await getGroupForGuest(token)).balances.members.find(row => row.id === 2).net, "-5.00");
});
test("unrelated payment allocations and remaining expenses stay effective", async () => {
  await expense("10.00", "Dinner");
  await createPayment(owner, proposal());
  await createPayment(owner, proposal("3.00", [{ expenseId: "2", amount: "3.00" }]));
  const unrelated = structuredClone(state.rows.PaymentAllocation.find(row => row.paymentId === 2));
  await remove(1);
  assert.deepEqual(state.rows.PaymentAllocation.find(row => row.paymentId === 2), unrelated);
  assert.deepEqual(await totals(), { owed: "7.00", owing: "0.00" });
});
test("fully excluded pending reports reserve nothing and cannot later be confirmed", async () => {
  await report(); const old = await payment(); await remove();
  const ledger = await getLedgerForGroup(1), current = ledger.payments[0];
  assert.equal(current.status, "SENT"); assert.equal(pendingPaymentPence(current), 0n);
  assert.equal(canConfirmPayment(ledger.balances, ledger.payments, current), false);
  await assert.rejects(reviewPayment(owner, "1", "confirm", old.allocationVersion), /changed/);
  await assert.rejects(reviewPayment(owner, "1", "confirm", current.allocationVersion), /nothing to confirm/);
  const rows = BalanceList({ balances: ledger.balances, payments: ledger.payments, currentMemberId: 10, access: owner });
  assert.doesNotMatch(text(rows), /awaiting confirmation/);
  assert.match(text(PaymentPanel({ payments: ledger.payments })), /Excluded/);
});
test("partially excluded pending reports require fresh review and confirm only the remainder", async () => {
  await expense("10.00", "Dinner");
  await report("25.00", [{ expenseId: "1", amount: "20.00" }, { expenseId: "2", amount: "5.00" }]);
  const old = await payment(); await remove();
  await assert.rejects(reviewPayment(owner, "1", "confirm", old.allocationVersion), /changed/);
  const current = await payment(); assert.equal(pendingPaymentPence(current), 500n);
  await reviewPayment(owner, "1", "confirm", current.allocationVersion);
  assert.equal((await payment()).amount, "25.00");
  assert.deepEqual(await totals(), { owed: "5.00", owing: "0.00" });
  await reviewPayment(owner, "1", "confirm", old.allocationVersion);
  assert.deepEqual(await totals(), { owed: "5.00", owing: "0.00" });
});

test("excluded pending amounts do not block an unrelated direct payment of the original amount", async () => {
  await report();
  await remove();
  const next = await expense("20.00", "New expense");
  await createPayment(owner, proposal("20.00", [{ expenseId: String(next.id), amount: "20.00" }]));
  assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
  assert.equal(pendingPaymentPence(await payment()), 0n);
});
test("rejected payment history is retained, with exclusions and no balance effect", async () => {
  await report(); await reviewPayment(owner, "1", "reject"); await remove();
  assert.equal((await payment()).status, "REJECTED");
  assert.equal((await payment()).allocations[0].excluded, true);
  assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
});
for (const allocations of [undefined, [], [{ expenseId: "1", amount: "19.99" }], [{ expenseId: "1", amount: "10" }, { expenseId: "1", amount: "10" }], [{ expenseId: "1", amount: "20.001" }], [{ expenseId: "99", amount: "20.00" }]]) test(`invalid allocations rejected: ${JSON.stringify(allocations)}`, async () => {
  const before = structuredClone(state.rows);
  await assert.rejects(createPayment(owner, { ...proposal(), allocations }));
  assert.deepEqual(state.rows, before);
});
test("cross-group expenses and wrong sender/recipient relations cannot be allocated", async () => {
  state.rows.Expense.push({ id: 99, groupId: 99, amount: "20.00", paidByMemberId: 10 });
  state.rows.ExpenseParticipant.push({ expenseId: 99, memberId: 2, amountOwed: "20.00" });
  await assert.rejects(createPayment(owner, proposal("20.00", [{ expenseId: "99", amount: "20.00" }])), /existing expense/);
  const other = await expense("20.00", "Other payer"); state.rows.Expense.find(row => row.id === other.id).paidByMemberId = 2;
  await assert.rejects(createPayment(owner, proposal("5.00", [{ expenseId: String(other.id), amount: "5.00" }])), /existing expense|currently owe/);
});
test("allocations cannot exceed an expense share even when the group has more outstanding debt", async () => {
  await expense("20.00", "Other");
  await createPayment(owner, proposal("15.00"));
  await assert.rejects(report("6.00"), /remaining expense share/);
});
function legacy(status = "CONFIRMED") { state.rows.Payment.push({ id: 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "20.00", status, createdAt: "2026-01-01" }); }
test("historical payments are not guessed; explicit owner reconciliation unblocks deletion", async () => {
  legacy(); const before = structuredClone(state.rows.Payment);
  assert.equal(await totals(), null);
  await assert.rejects(remove(), /Reconcile historical payments/);
  const context = await getPaymentReconciliation(1, 1);
  assert.deepEqual(context.payment.allocations, []);
  assert.equal(context.expenses[0].id, 1);
  const version = context.payment.allocationVersion;
  await reconcilePayment(owner, "1", version, [{ expenseId: "1", amount: "20.00" }]);
  await reconcilePayment(owner, "1", version, [{ expenseId: "1", amount: "20.00" }]);
  assert.deepEqual(state.rows.Payment, before);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "PAYMENT_RECONCILED").length, 1);
  assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
  await remove(); assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
});
test("unresolved pending history blocks deletion and confirmation but may be rejected", async () => {
  legacy("SENT"); const current = await payment();
  await assert.rejects(remove(), /Reconcile/);
  await assert.rejects(reviewPayment(owner, "1", "confirm", current.allocationVersion), /Reconcile/);
  await reviewPayment(owner, "1", "reject");
  await remove(); assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
});
for (const kind of ["guest", "anonymous", "other owner", "foreign payment"]) test(`reconciliation rejects ${kind}`, async () => {
  legacy(); const version = (await payment()).allocationVersion;
  if (kind === "anonymous") state.cookies.clear();
  if (kind === "other owner") state.rows.Group[0].createdBy = 99;
  const before = structuredClone(state.rows);
  await assert.rejects(reconcilePayment(kind === "guest" ? guest : owner, kind === "foreign payment" ? "99" : "1", version, [{ expenseId: "1", amount: "20.00" }]));
  assert.deepEqual(state.rows, before);
});
test("owner may explicitly correct active associations, but stale/ABA edits fail", async () => {
  await expense("20.00", "Other"); await createPayment(owner, proposal());
  const original = await payment();
  await reconcilePayment(owner, "1", original.allocationVersion, [{ expenseId: "2", amount: "20.00" }]);
  await assert.rejects(reconcilePayment(owner, "1", original.allocationVersion, [{ expenseId: "1", amount: "20.00" }]), /changed/);
  await reconcilePayment(owner, "1", (await payment()).allocationVersion, [{ expenseId: "1", amount: "20.00" }]);
  await assert.rejects(reconcilePayment(owner, "1", original.allocationVersion, [{ expenseId: "2", amount: "20.00" }]), /changed/);
});
test("excluded allocations can never be reassigned or revived through reconciliation or retries", async () => {
  await expense("20.00", "Other"); const input = proposal(); await createPayment(owner, input); await remove();
  assert.equal((await createPayment(owner, input)).replay, true);
  const current = await payment();
  await assert.rejects(reconcilePayment(owner, "1", current.allocationVersion, [{ expenseId: "2", amount: "20.00" }]), /original payment amount/);
  await assert.rejects(reconcilePayment(owner, "1", current.allocationVersion, [{ expenseId: "1", amount: "20.00" }]), /cannot be reassigned/);
  await assert.rejects(createPayment(owner, { ...input, allocations: [{ expenseId: "2", amount: "20.00" }] }), /different payment details/);
  assert.equal(effectivePaymentPence(await payment()), 0n);
});
test("payer/participant/share edits incompatible with associations fail until explicitly resolved", async () => {
  await createPayment(owner, proposal("10.00")); const saved = await getSavedExpenseForOwner(1, 1);
  for (const patch of [{ paidByMemberId: "2" }, { participantIds: ["10"], shares: [{ memberId: "10", amount: "20.00" }] }, { amount: "5.00", shares: [{ memberId: "2", amount: "5.00" }] }]) {
    await assert.rejects(updateSavedExpense(1, 1, saved.version, { ...saved.input, ...patch }), /association|share/);
  }
  await expense("20.00", "Other");
  await reconcilePayment(owner, "1", (await payment()).allocationVersion, [{ expenseId: "2", amount: "10.00" }]);
  await updateSavedExpense(1, 1, saved.version, { ...saved.input, paidByMemberId: "2" });
  assert.equal(state.rows.PaymentAllocation[0].expenseId, 2);
});
for (const failure of ["Expense.updateAll", "ActivityEvent.create"]) test(`deletion exclusion rollback at ${failure}`, async () => {
  await createPayment(owner, proposal()); const saved = await getSavedExpenseForOwner(1, 1), before = structuredClone(state.rows);
  state.failAt = failure;
  await assert.rejects(deleteSavedExpense(1, 1, saved.version), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
for (const failure of ["PaymentAllocation.create", "ActivityEvent.create"]) test(`reconciliation rollback at ${failure}`, async () => {
  legacy(); const version = (await payment()).allocationVersion, before = structuredClone(state.rows); state.failAt = failure;
  await assert.rejects(reconcilePayment(owner, "1", version, [{ expenseId: "1", amount: "20.00" }]), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
for (const first of ["confirm", "delete"]) test(`serialized ${first}-first confirmation/deletion cannot resurrect allocations`, async () => {
  await report(); const version = (await payment()).allocationVersion, saved = await getSavedExpenseForOwner(1, 1);
  const confirm = () => reviewPayment(owner, "1", "confirm", version), del = () => deleteSavedExpense(1, 1, saved.version);
  const results = await Promise.allSettled(first === "confirm" ? [confirm(), del()] : [del(), confirm()]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, first === "confirm" ? "fulfilled" : "rejected");
  assert.deepEqual(await totals(), { owed: "0.00", owing: "0.00" });
});
test("reconciliation action refreshes all affected views and requires explicit confirmation", async () => {
  legacy(); const version = (await payment()).allocationVersion, form = new FormData();
  form.set("allocationExpenseId", "1"); form.set("allocationAmount", "20.00");
  assert.match((await reconcilePaymentAction(1, 1, version, {}, form)).error, /Confirm/);
  form.set("confirmed", "yes"); assert.ok((await reconcilePaymentAction(1, 1, version, {}, form)).success);
  assert.deepEqual(state.revalidated, ["/dashboard", "/groups/1", `/g/${token}/group`]);
});
test("allocation fields retain exact entered amounts across disclosure-style rerenders", () => {
  const props = { expenses: [{ id: 1, description: "Court" }, { id: 2, description: "Dinner" }], amount: "20.01", prefix: "test" };
  let tree = renderWithState(AllocationFields, props);
  nodes(tree).find(row => row.props.id === "test-1").props.onChange({ target: { value: "7.01" } });
  tree = renderWithState(AllocationFields, props);
  assert.equal(nodes(tree).find(row => row.props.id === "test-1").props.value, "7.01");
  assert.match(text(tree), /13.00/);
  assert.equal(nodes(tree).filter(row => row.props.name === "allocationExpenseId").length, 1);
});
test("owner reconciliation navigation and review version are exposed without guest management links", async () => {
  legacy(); const current = await payment();
  assert.ok(nodes(PaymentPanel({ payments: [current], ownerGroupId: 1 })).some(row => row.props.href === "/groups/1/payments/1/reconcile"));
  assert.ok(!nodes(PaymentPanel({ payments: [current] })).some(row => row.props.href));
  assert.equal(nodes(PaymentReview({ payment: current, groupId: 1, currentMemberId: 10, canConfirm: false })).find(row => row.props.name === "allocationVersion").props.value, current.allocationVersion);
  assert.match(text(await ReconcilePage({ params: Promise.resolve({ groupId: "1", paymentId: "1" }) })), /Reconcile payment expenses/);
  state.cookies.delete("splitmate_owner_session");
  await assert.rejects(ReconcilePage({ params: Promise.resolve({ groupId: "1", paymentId: "1" }) }), { destination: "/login?next=/dashboard" });
});

test("deleted expense outside the latest display list still excludes its allocations from dashboard totals", async () => {
  await createPayment(owner, proposal());
  for (let index = 0; index < 55; index++) await expense("1.01", `Later ${index}`);
  assert.ok(!(await getGroupForOwner(7, 1)).expenses.some(row => row.id === 1));
  await remove(1);
  assert.deepEqual(await totals(), { owed: "55.55", owing: "0.00" });
  assert.equal((await getLedgerForGroup(1)).balances.expenseCount, 55);
});
test("allocation insert failure rolls back the payment and its activity", async () => {
  const before = structuredClone(state.rows); state.failAt = "PaymentAllocation.create";
  await assert.rejects(createPayment(owner, proposal()), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
test("reconciliation rejects a historical cross-group financial identity", async () => {
  legacy(); state.rows.GroupMember.find(row => row.id === 2).groupId = 99;
  await assert.rejects(reconcilePayment(owner, "1", (await payment()).allocationVersion, [{ expenseId: "1", amount: "20.00" }]), /Both payment members/);
  assert.equal(state.rows.PaymentAllocation.length, 0);
});
test("reconciliation audit records both previous and new associations", async () => {
  await expense("20.00", "Other"); await createPayment(owner, proposal());
  assert.match(state.rows.ActivityEvent.at(-1).description, /allocations: expense #1/);
  await reconcilePayment(owner, "1", (await payment()).allocationVersion, [{ expenseId: "2", amount: "20.00" }]);
  assert.match(state.rows.ActivityEvent.at(-1).description, /Previous associations: expense #1.*New active associations: expense #2/);
});
test("malformed stored allocations never produce partial financial totals", async () => {
  await createPayment(owner, proposal());
  state.rows.PaymentAllocation[0].amountPence = 1999n;
  assert.equal(await totals(), null);
  await assert.rejects(remove(), /allocations do not match/);
  assert.equal(state.rows.Expense[0].deletedAt, undefined);
});
