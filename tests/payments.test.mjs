import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { db, installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { createPayment, reviewPayment: reviewPaymentService } = await import("../src/data/payments.ts");
const { calculateBalances, getBalancesForGroup, getLedgerForGroup } = await import("../src/data/balances.ts");
const { createExpense } = await import("../src/data/expenses.ts");
const { getGroupForOwner } = await import("../src/data/groups.ts");
const { getGroupForGuest } = await import("../src/data/guest-groups.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
const owner = { kind: "owner", groupId: 1 };
const guest = { kind: "guest", shareToken: token };
beforeEach(async () => {
  reset();
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ id: 1, userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true, addedAt: "2026-01-01" });
  await setGuestSessionCookie(await claimMember(token, 2));
  // Guest owes owner 20.01; payer does not participate in the expense.
  state.rows.Expense.push({ id: 1, groupId: 1, paidByMemberId: 10, amount: "20.01", description: "Lunch", createdAt: "2026-01-01", splitMethod: "EQUAL" });
  state.rows.ExpenseParticipant.push({ id: 1, expenseId: 1, memberId: 2, amountOwed: "20.01" });
  state.rows.ActivityEvent = [];
});
const input = (patch = {}) => ({ receiverMemberId: "10", amount: "10.00", requestKey: randomUUID(), allocations: [{ expenseId: "1", amount: patch.amount ?? "10.00" }], ...patch });
async function reviewPayment(access, id, decision) {
  const version = access.kind === "owner" ? (await getLedgerForGroup(access.groupId)).payments.find(row => row.id === Number(id))?.allocationVersion : undefined;
  return reviewPaymentService(access, id, decision, version);
}
const direct = (patch = {}) => input({ payerMemberId: "2", ...patch });
function net(result, id) { assert.equal(result.status, "ready"); return result.members.find(member => member.id === id).net; }
function zeroSum(result) {
  assert.equal(result.status, "ready");
  assert.equal(result.totalPaid, result.totalShare);
  assert.equal(result.members.reduce((sum, member) => sum + BigInt(member.net.replace(".", "")), 0n), 0n);
}

test("guest report derives sender and actor, reserves debt without changing balances", async () => {
  const saved = await createPayment(guest, input());
  const payment = state.rows.Payment[0];
  assert.equal(payment.id, saved.id);
  assert.equal(payment.payerMemberId, 2);
  assert.equal(payment.recordedByMemberId, 2);
  assert.equal(payment.status, "SENT");
  assert.equal(payment.confirmedAt, null);
  assert.ok(payment.sentAt);
  assert.equal(state.rows.ActivityEvent[0].memberId, 2);
  assert.equal(state.rows.ActivityEvent[0].eventType, "PAYMENT_SENT");
  assert.equal(net(await getBalancesForGroup(1), 2), "-20.01");
});

test("owner confirms partial payment with correct signs and expense totals unchanged", async () => {
  const report = await createPayment(guest, input({ amount: "7.01" }));
  await reviewPayment(owner, String(report.id), "confirm");
  const balances = await getBalancesForGroup(1);
  zeroSum(balances);
  assert.equal(net(balances, 2), "-13.00");
  assert.equal(net(balances, 10), "13.00");
  assert.equal(balances.members.find(row => row.id === 2).sent, "7.01");
  assert.equal(balances.members.find(row => row.id === 10).received, "7.01");
  assert.equal(balances.totalPaid, "20.01");
  assert.equal(state.rows.Payment[0].reviewedByMemberId, 10);
  assert.ok(state.rows.Payment[0].confirmedAt);
  assert.equal(state.rows.ActivityEvent[1].eventType, "PAYMENT_CONFIRMED");
  assert.equal(state.rows.ActivityEvent[1].memberId, 10);
});

test("rejection remains visible, releases reservation and never changes balances", async () => {
  const report = await createPayment(guest, input({ amount: "20.01" }));
  await reviewPayment(owner, String(report.id), "reject");
  const group = await getGroupForGuest(token);
  assert.equal(group.payments[0].status, "REJECTED");
  assert.equal(net(group.balances, 2), "-20.01");
  assert.equal(state.rows.Payment[0].confirmedAt, null);
  assert.ok(state.rows.Payment[0].reviewedAt);
  assert.ok(group.activity.some(row => /rejected/.test(row.description)));
  await createPayment(guest, input({ amount: "20.01" }));
  assert.equal(state.rows.Payment.length, 2);
});

test("owner directly records payments for unclaimed guests with owner audit identity", async () => {
  state.rows.GroupMember[0].claimedAt = null;
  const result = await createPayment(owner, direct({ amount: "20.01" }));
  assert.equal(state.rows.Payment[0].status, "CONFIRMED");
  assert.equal(state.rows.Payment[0].creationKind, "DIRECT");
  assert.equal(state.rows.Payment[0].recordedByMemberId, 10);
  assert.equal(state.rows.ActivityEvent[0].eventType, "PAYMENT_RECORDED");
  assert.equal(result.groupId, 1);
  const balances = await getBalancesForGroup(1);
  zeroSum(balances);
  assert.equal(net(balances, 2), "0.00");
});

test("non-owner recipients and multiple partial payments settle exact pennies", async () => {
  state.rows.GroupMember.push({ id: 3, groupId: 1, name: "Recipient", isActive: true, role: "MEMBER", userId: null });
  state.rows.Expense[0].paidByMemberId = 3;
  const report = await createPayment(guest, input({ receiverMemberId: "3", amount: "0.01" }));
  await reviewPayment(owner, String(report.id), "confirm");
  await createPayment(owner, direct({ receiverMemberId: "3", amount: "20.00" }));
  const balances = await getBalancesForGroup(1);
  zeroSum(balances);
  assert.equal(net(balances, 2), "0.00");
  assert.equal(net(balances, 3), "0.00");
  assert.equal(balances.members.find(row => row.id === 3).received, "20.01");
});

test("guest cannot impersonate a sender or review even when also logged in as owner", async () => {
  await assert.rejects(createPayment(guest, direct()), /unsupported fields/);
  await assert.rejects(reviewPayment(guest, "1", "confirm"), /Only the group owner/);
  await assert.rejects(reviewPayment(guest, "1", "reject"), /Only the group owner/);
  assert.equal(state.rows.Payment.length, 0);
});

for (const amount of ["0", "-1", "0.001", "1e2", "NaN", "£1", "1,000", "1000000000", "", 1]) test(`rejects invalid amount ${JSON.stringify(amount)}`, async () => {
  await assert.rejects(createPayment(guest, input({ amount })));
  assert.equal(state.rows.Payment.length, 0);
});
for (const [label, patch] of [["self payment", { receiverMemberId: "2" }], ["foreign recipient", { receiverMemberId: "99" }], ["overpayment", { amount: "20.02" }], ["invalid key", { requestKey: "bad" }]]) test(`rejects ${label}`, async () => {
  state.rows.GroupMember.push({ id: 99, groupId: 99, name: "Foreign", isActive: true });
  await assert.rejects(createPayment(guest, input(patch)));
  assert.equal(state.rows.Payment.length, 0);
});
test("sender must owe and recipient must be owed", async () => {
  await assert.rejects(createPayment(owner, direct({ payerMemberId: "10", receiverMemberId: "2" })), /must currently owe/);
});
for (const [label, alter, access] of [
  ["missing owner", () => state.cookies.delete("splitmate_owner_session"), owner],
  ["expired owner", () => { state.rows.UserSession[0].expiresAt = "2000-01-01"; }, owner],
  ["wrong owner", () => { state.rows.Group[0].createdBy = 99; }, owner],
  ["missing guest", () => state.cookies.delete("splitmate_guest_session"), guest],
  ["expired guest", () => { state.rows.GuestSession[0].expiresAt = "2000-01-01"; }, guest],
  ["inactive guest", () => { state.rows.GroupMember[0].isActive = false; }, guest],
  ["malformed token", () => {}, { kind: "guest", shareToken: "bad" }],
  ["different group", () => {}, { kind: "owner", groupId: 99 }],
]) test(`denies ${label}`, async () => {
  alter();
  await assert.rejects(createPayment(access, access.kind === "owner" ? direct() : input()));
  assert.equal(state.rows.Payment.length, 0);
});

test("cross-group payment review and cross-group guest token are denied", async () => {
  const otherToken = Buffer.alloc(32, 2).toString("base64url");
  state.rows.Group.push({ ...state.rows.Group[0], id: 99, shareToken: otherToken });
  await assert.rejects(createPayment({ kind: "guest", shareToken: otherToken }, input()), /access/);
  state.rows.Payment.push({ id: 99, groupId: 99 });
  await assert.rejects(reviewPayment(owner, "99", "confirm"), /not found/);
});

test("same request retries before and after confirmation create one payment and one report event", async () => {
  const proposal = input();
  const first = await createPayment(guest, proposal);
  assert.equal((await createPayment(guest, proposal)).id, first.id);
  await reviewPayment(owner, String(first.id), "confirm");
  assert.equal((await createPayment(guest, proposal)).replay, true);
  assert.equal(state.rows.Payment.length, 1);
  assert.deepEqual(state.rows.ActivityEvent.map(row => row.eventType), ["PAYMENT_SENT", "PAYMENT_CONFIRMED"]);
  await assert.rejects(createPayment(guest, { ...proposal, amount: "9", allocations: [{ expenseId: "1", amount: "9" }] }), /different payment details/);
  await assert.rejects(createPayment(owner, { ...proposal, payerMemberId: "2" }), /different payment details/);
});

test("direct retries remain idempotent even after debt is fully settled", async () => {
  const proposal = direct({ amount: "20.01" });
  const first = await createPayment(owner, proposal);
  assert.equal((await createPayment(owner, proposal)).id, first.id);
  assert.equal(state.rows.ActivityEvent.length, 1);
});

test("owner is guided to equivalent pending report instead of duplicating it", async () => {
  await createPayment(guest, input());
  await assert.rejects(createPayment(owner, direct()), /equivalent payment.*Confirm that report/);
  assert.equal(state.rows.Payment.length, 1);
});

test("pending outgoing reservations limit both new reports and direct payments", async () => {
  await createPayment(guest, input({ amount: "15.00" }));
  await assert.rejects(createPayment(guest, input({ amount: "5.02" })), /available debt or credit/);
  await assert.rejects(createPayment(owner, direct({ amount: "5.02" })), /available debt or credit/);
  await createPayment(guest, input({ amount: "5.01" }));
  assert.equal(net(await getBalancesForGroup(1), 2), "-20.01");
});

test("incoming reservations apply across different senders", async () => {
  state.rows.GroupMember.push({ id: 3, groupId: 1, name: "Second debtor", isActive: true });
  state.rows.ExpenseParticipant = [{ expenseId: 1, memberId: 2, amountOwed: "10.00" }, { expenseId: 1, memberId: 3, amountOwed: "10.01" }];
  // Another creditor means sender debt alone is not enough to validate capacity.
  state.rows.GroupMember.push({ id: 4, groupId: 1, name: "Other creditor", isActive: true });
  state.rows.Expense.push({ id: 2, groupId: 1, paidByMemberId: 4, amount: "20.00" });
  state.rows.ExpenseParticipant.push({ expenseId: 2, memberId: 3, amountOwed: "20.00" });
  await createPayment(guest, input({ amount: "10.00" }));
  await assert.rejects(createPayment(owner, direct({ payerMemberId: "3", amount: "10.02" })), /available debt or credit/);
  await createPayment(owner, direct({ payerMemberId: "3", amount: "10.01" }));
});

test("stale confirmation after a new expense never silently changes the reported amount", async () => {
  const report = await createPayment(guest, input({ amount: "20.01" }));
  await createExpense(owner, { description: "Reverse debt", amount: "5.00", paidByMemberId: "2", participantIds: ["10"] }, randomUUID());
  await assert.rejects(reviewPayment(owner, String(report.id), "confirm"), /amount has not been changed/);
  assert.equal(state.rows.Payment[0].status, "SENT");
  assert.equal(state.rows.Payment[0].amount, "20.01");
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "PAYMENT_CONFIRMED").length, 0);
});

test("inactive historical payments remain; inactive reports can be rejected but not confirmed", async () => {
  await createPayment(owner, direct({ amount: "1.00" }));
  const report = await createPayment(guest, input({ amount: "2.00" }));
  state.rows.GroupMember[0].isActive = false;
  const ledger = await getLedgerForGroup(1);
  assert.equal(ledger.payments.length, 2);
  assert.equal(net(ledger.balances, 2), "-19.01");
  await assert.rejects(reviewPayment(owner, String(report.id), "confirm"), /active members/);
  await reviewPayment(owner, String(report.id), "reject");
});

test("simulated concurrent identical creation and repeated confirmations have one financial effect", async () => {
  const proposal = input({ amount: "20.01" });
  const reports = await Promise.all([createPayment(guest, proposal), createPayment(guest, proposal)]);
  assert.equal(reports[0].id, reports[1].id);
  const results = await Promise.all([reviewPayment(owner, "1", "confirm"), reviewPayment(owner, "1", "confirm")]);
  assert.deepEqual(results.map(row => row.replay), [false, true]);
  assert.equal(state.rows.Payment.length, 1);
  assert.equal(state.rows.ActivityEvent.length, 2);
  assert.equal(net(await getBalancesForGroup(1), 2), "0.00");
  await assert.rejects(reviewPayment(owner, "1", "reject"), /already been reviewed/);
});

test("simulated competing distinct creations cannot over-reserve or over-settle", async () => {
  const results = await Promise.allSettled([createPayment(owner, direct({ amount: "15" })), createPayment(owner, direct({ amount: "15" }))]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(net(await getBalancesForGroup(1), 2), "-5.01");
});

test("simulated confirmation versus rejection has one terminal status and event", async () => {
  await createPayment(guest, input());
  const results = await Promise.allSettled([reviewPayment(owner, "1", "reject"), reviewPayment(owner, "1", "confirm")]);
  assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
  assert.equal(state.rows.Payment[0].status, "REJECTED");
  await reviewPayment(owner, "1", "reject");
  assert.equal(state.rows.ActivityEvent.length, 2);
});

for (const failure of ["Payment.create", "ActivityEvent.create", "GroupMember.updateAll", "Group.updateAll"]) test(`creation rollback at ${failure}`, async () => {
  const before = structuredClone(state.rows);
  state.failAt = failure;
  await assert.rejects(createPayment(owner, direct()), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});
for (const failure of ["Payment.updateAll", "ActivityEvent.create"]) test(`confirmation rollback at ${failure}`, async () => {
  await createPayment(guest, input());
  const before = structuredClone(state.rows);
  state.failAt = failure;
  await assert.rejects(reviewPayment(owner, "1", "confirm"), /PRIVATE_DATABASE_DETAILS/);
  assert.deepEqual(state.rows, before);
});

test("consistent ledger reads bracket a simulated mutable payment transition", async () => {
  await createPayment(guest, input());
  const version = (await getLedgerForGroup(1)).payments[0].allocationVersion;
  const [before, , after] = await Promise.all([getLedgerForGroup(1), reviewPaymentService(owner, "1", "confirm", version), getLedgerForGroup(1)]);
  assert.equal(before.payments[0].status, "SENT");
  assert.equal(net(before.balances, 2), "-20.01");
  assert.equal(after.payments[0].status, "CONFIRMED");
  assert.equal(net(after.balances, 2), "-10.01");
  zeroSum(before.balances); zeroSum(after.balances);
  assert.ok(state.writes.includes("Group.updateAll"));
});

test("session expiring during simulated group lock wait is rejected", async () => {
  let release;
  const blocked = db.transaction(async tx => {
    await new Promise(resolve => { release = resolve; });
    await tx.orm.public.GuestSession.where({ id: 1 }).updateAll({ expiresAt: "2000-01-01" });
  });
  await new Promise(resolve => setImmediate(resolve));
  const pending = createPayment(guest, input());
  release(); await blocked;
  await assert.rejects(pending, /expired|unavailable/);
});

test("complete payment history exceeds 50 and owner/guest balances agree without leaking keys", async () => {
  state.rows.Payment = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, groupId: 1, payerMemberId: 2, receiverMemberId: 10, amount: "0.01", status: "CONFIRMED", createdAt: "2026-01-01", requestKey: randomUUID(), recordedByMemberId: 10 }));
  state.rows.PaymentAllocation = state.rows.Payment.map(payment => ({ id: payment.id, paymentId: payment.id, expenseId: 1, amountPence: 1n }));
  const ownerGroup = await getGroupForOwner(7, 1);
  const guestGroup = await getGroupForGuest(token);
  assert.deepEqual(ownerGroup.balances, guestGroup.balances);
  assert.equal(guestGroup.payments.length, 60);
  assert.equal(net(guestGroup.balances, 2), "-19.41");
  assert.doesNotMatch(JSON.stringify(guestGroup), /requestKey|recordedByMemberId|tokenHash/);
});

for (const patch of [{ status: "UNKNOWN" }, { payerMemberId: 99 }, { receiverMemberId: 2 }, { amount: "-1" }]) test(`invalid payment ledger is unavailable ${JSON.stringify(patch)}`, () => {
  const payment = { id: 1, payerMemberId: 2, receiverMemberId: 10, amount: "1.00", status: "CONFIRMED", ...patch };
  assert.deepEqual(calculateBalances(state.rows.GroupMember, state.rows.Expense, state.rows.ExpenseParticipant, [payment]), { status: "unavailable" });
});

test("financial reads and payment mutations take the group lock before reading the ledger", async () => {
  for (const action of [() => getLedgerForGroup(1), () => createPayment(guest, input()), () => reviewPayment(owner, "1", "confirm")]) {
    state.operations = [];
    await action();
    const lock = state.operations.indexOf("Group.updateAll");
    assert.ok(lock >= 0);
    for (const read of ["Expense.all", "ExpenseParticipant.all", "Payment.all"]) assert.ok(state.operations.indexOf(read) > lock, read);
    for (const write of ["Payment.create", "Payment.updateAll"]) {
      if (state.operations.includes(write)) assert.ok(state.operations.indexOf(write) > state.operations.indexOf("Payment.all"));
    }
  }
});

test("confirmed aggregate repayments retain exact pence beyond Number safe integer", () => {
  const members = [{ id: 1, name: "Creditor", isActive: true }, { id: 2, name: "Debtor", isActive: true }];
  const expenses = Array.from({ length: 100001 }, (_, i) => ({ id: i + 1, paidByMemberId: 1, amount: "999999999.99" }));
  const shares = expenses.map(row => ({ expenseId: row.id, memberId: 2, amountOwed: row.amount }));
  const payments = expenses.map(row => ({ id: row.id, payerMemberId: 2, receiverMemberId: 1, amount: row.amount, status: "CONFIRMED" }));
  for (const payment of payments) payment.allocations = [{ expenseId: payment.id, amountPence: "99999999999", excluded: false, valid: true }];
  const balances = calculateBalances(members, expenses, shares, payments);
  zeroSum(balances);
  assert.equal(balances.members[1].sent, "100000999998999.99");
  assert.equal(balances.members[0].received, "100000999998999.99");
  assert.equal(net(balances, 1), "0.00");
  assert.equal(net(balances, 2), "0.00");
});

test("disabled share links preserve existing guest report permissions", async () => {
  state.rows.Group[0].shareLinkEnabled = false;
  await createPayment(guest, input());
  assert.equal(state.rows.Payment[0].status, "SENT");
});

test("unsupported currency and inconsistent balances prevent payment creation", async () => {
  state.rows.Group[0].currency = "USD";
  await assert.rejects(createPayment(guest, input()), /GBP/);
  state.rows.Group[0].currency = "GBP";
  state.rows.ExpenseParticipant[0].amountOwed = "1.00";
  await assert.rejects(createPayment(guest, input()), /Balances are unavailable/);
  assert.equal(state.rows.Payment.length, 0);
});
