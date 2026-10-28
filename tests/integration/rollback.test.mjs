import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { fixture, snapshot } from "./fixtures.mjs";
import { call, worker } from "./harness.mjs";

async function fail(t, f, operation, args, cookies, stage, event = null) {
  const request = await worker(t, operation, args, cookies);
  await f.observer.query('INSERT INTO splitmate_test_control.faults(worker,"groupId",stage,event) VALUES ($1,$2,$3,$4)', [request.label, f.groupId, stage, event]);
  try { request.start(); const result = await request.result; assert.equal(result.ok, false); assert.equal(result.code, "P0001", `Expected the deliberate PostgreSQL failure, got ${JSON.stringify(result)}`); }
  finally { await f.observer.query("DELETE FROM splitmate_test_control.faults WHERE worker=$1", [request.label]); }
}

for (const stage of ["share_second", "activity"]) for (const kind of ["owner", "guest"]) test(`${kind} expense ${stage} failure rolls back all writes and request key`, async t => {
  const f = await fixture(t); const key = randomUUID();
  const input = { ...f.expense(), participantIds: [String(f.guestId), String(f.ownerId)], shares: [{ memberId: String(f.guestId), amount: "6" }, { memberId: String(f.ownerId), amount: "4" }] };
  const before = await snapshot(f.observer, f.groupId);
  await fail(t, f, "createExpense", [f[kind], input, key], f[`${kind}Cookies`], stage, "EXPENSE_CREATED");
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  await call(t, "createExpense", [f[kind], input, key], f[`${kind}Cookies`]);
  const after = await snapshot(f.observer, f.groupId);
  assert.equal(after.expense.length, 1); assert.equal(after.shares.length, 2); assert.equal(after.activityEvent.length, 1);
});

test("claim failure after member/session writes completely rolls back", async t => {
  const f = await fixture(t); const before = await snapshot(f.observer, f.groupId);
  await fail(t, f, "claimMember", [f.shareToken, f.unclaimedId], {}, "activity", "MEMBER_CLAIMED");
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  await call(t, "claimMember", [f.shareToken, f.unclaimedId]);
  const after = await snapshot(f.observer, f.groupId);
  assert.equal(after.sessions.length, before.sessions.length + 1); assert.equal(after.activityEvent.length, 1);
});

for (const stage of ["allocation", "activity"]) test(`payment ${stage} failure leaves no payment/reservation/event`, async t => {
  const f = await fixture(t);
  const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
  const input = { requestKey: randomUUID(), receiverMemberId: String(f.ownerId), amount: "10", allocations: [{ expenseId: String(expense.id), amount: "10" }] };
  const before = await snapshot(f.observer, f.groupId);
  await fail(t, f, "createPayment", [f.guest, input], f.guestCookies, stage, "PAYMENT_SENT");
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  await call(t, "createPayment", [f.guest, input], f.guestCookies);
  const after = await snapshot(f.observer, f.groupId);
  assert.equal(after.payment.length, 1); assert.equal(after.allocations.length, 1);
  assert.equal(after.activityEvent.filter(row => row.eventType === "PAYMENT_SENT").length, 1);
});

test("confirmation failure after payment status update preserves SENT and original balances", async t => {
  const f = await fixture(t);
  const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
  const payment = await call(t, "createPayment", [f.guest, { requestKey: randomUUID(), receiverMemberId: String(f.ownerId), amount: "10", allocations: [{ expenseId: String(expense.id), amount: "10" }] }], f.guestCookies);
  const ledger = await call(t, "getLedgerForGroup", [f.groupId]);
  const args = [f.owner, String(payment.id), "confirm", ledger.payments[0].allocationVersion];
  const before = await snapshot(f.observer, f.groupId);
  await fail(t, f, "reviewPayment", args, f.ownerCookies, "activity", "PAYMENT_CONFIRMED");
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  assert.deepEqual(await call(t, "getLedgerForGroup", [f.groupId]), ledger);
  await call(t, "reviewPayment", args, f.ownerCookies);
  assert.equal((await snapshot(f.observer, f.groupId)).payment[0].status, "CONFIRMED");
});

test("group deletion failure after deleting financial records restores every dependent row", async t => {
  const f = await fixture(t);
  const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
  await call(t, "createPayment", [f.guest, { requestKey: randomUUID(), receiverMemberId: String(f.ownerId), amount: "10", allocations: [{ expenseId: String(expense.id), amount: "10" }] }], f.guestCookies);
  const before = await snapshot(f.observer, f.groupId);
  await fail(t, f, "deleteGroupForOwner", [f.groupId], f.ownerCookies, "member_delete");
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  await call(t, "deleteGroupForOwner", [f.groupId], f.ownerCookies);
  assert.ok(Object.values(await snapshot(f.observer, f.groupId)).every(rows => rows.length === 0));
});
