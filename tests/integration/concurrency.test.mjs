import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { test } from "node:test";
import { fixture, snapshot } from "./fixtures.mjs";
import { call, race, worker } from "./harness.mjs";

const eventCount = (rows, type) => rows.activityEvent.filter(row => row.eventType === type).length;
function payment(f, expenseId, amount = "7.00") {
  return { receiverMemberId: String(f.ownerId), amount, requestKey: randomUUID(), allocations: [{ expenseId: String(expenseId), amount }] };
}

test("two PostgreSQL claim transactions contend: exactly one claim/session/event", async t => {
  const f = await fixture(t);
  const request = ["claimMember", [f.shareToken, f.unclaimedId], {}];
  const results = await race(t, f.observer, f.groupId, request, request);
  assert.deepEqual(results.map(row => row.ok), [true, false]);
  assert.match(results[1].message, /already been claimed/);
  const rows = await snapshot(f.observer, f.groupId);
  assert.ok(rows.groupMember.find(row => row.id === f.unclaimedId).claimedAt);
  assert.equal(rows.sessions.filter(row => row.groupMemberId === f.unclaimedId).length, 1);
  assert.equal(eventCount(rows, "MEMBER_CLAIMED"), 1);
});

for (const kind of ["owner", "guest"]) test(`${kind} simultaneous identical expense requests return one committed ID`, async t => {
  const f = await fixture(t); const key = randomUUID();
  const request = ["createExpense", [f[kind], f.expense(), key], f[`${kind}Cookies`]];
  const results = await race(t, f.observer, f.groupId, request, request);
  assert.ok(results.every(row => row.ok), JSON.stringify(results));
  assert.deepEqual(results[0].value, results[1].value);
  const rows = await snapshot(f.observer, f.groupId);
  assert.equal(rows.expense.length, 1); assert.equal(rows.shares.length, 1);
  assert.equal(rows.expense[0].requestKey, key); assert.equal(rows.shares[0].amountOwed, "10.00");
  assert.equal(eventCount(rows, "EXPENSE_CREATED"), 1);
  assert.equal(rows.activityEvent[0].memberId, kind === "owner" ? f.ownerId : f.guestId);
});

for (const kind of ["owner", "guest"]) test(`${kind} lost committed response, canonical replay, conflict and distinct key`, async t => {
  const f = await fixture(t); const key = randomUUID(); const input = f.expense();
  // Wait for commit, deliberately discard the returned value at the transport boundary.
  await call(t, "createExpense", [f[kind], input, key], f[`${kind}Cookies`]);
  const before = await snapshot(f.observer, f.groupId);
  const replay = await call(t, "createExpense", [f[kind], { ...input, description: " Court ", amount: "10", shares: [{ memberId: String(f.guestId), amount: "10.0" }] }, key], f[`${kind}Cookies`]);
  assert.equal(replay.id, before.expense[0].id);
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  for (const patch of [{ description: "Changed" }, { paidByMemberId: String(f.guestId) },
    { amount: "11", shares: [{ memberId: String(f.guestId), amount: "11" }] },
    { participantIds: [String(f.ownerId)], shares: [{ memberId: String(f.ownerId), amount: "10" }] }]) {
    const conflict = await worker(t, "createExpense", [f[kind], { ...input, ...patch }, key], f[`${kind}Cookies`]); conflict.start();
    const result = await conflict.result; assert.equal(result.ok, false); assert.match(result.message, /different expense details/);
    assert.deepEqual(await snapshot(f.observer, f.groupId), before);
  }
  const other = await call(t, "createExpense", [f[kind], input, randomUUID()], f[`${kind}Cookies`]);
  assert.notEqual(other.id, replay.id);
  assert.equal((await snapshot(f.observer, f.groupId)).expense.length, 2);
});

for (const kind of ["owner", "guest"]) test(`${kind} original request replays after edit and soft deletion without restoring allocations`, async t => {
  const f = await fixture(t); const key = randomUUID();
  const created = await call(t, "createExpense", [f[kind], f.expense(), key], f[`${kind}Cookies`]);
  const saved = await call(t, "getSavedExpenseForOwner", [f.groupId, created.id], f.ownerCookies);
  await call(t, "updateSavedExpense", [f.groupId, created.id, saved.version, { ...f.expense(), description: "Edited" }], f.ownerCookies);
  const edited = await snapshot(f.observer, f.groupId);
  await call(t, "createExpense", [f[kind], f.expense(), key], f[`${kind}Cookies`]);
  assert.deepEqual(await snapshot(f.observer, f.groupId), edited);
  await call(t, "createPayment", [f.owner, { ...payment(f, created.id, "10"), payerMemberId: String(f.guestId) }], f.ownerCookies);
  const current = await call(t, "getSavedExpenseForOwner", [f.groupId, created.id], f.ownerCookies);
  await call(t, "deleteSavedExpense", [f.groupId, created.id, current.version], f.ownerCookies);
  const deleted = await snapshot(f.observer, f.groupId);
  assert.ok(deleted.expense[0].deletedAt);
  await call(t, "createExpense", [f[kind], f.expense(), key], f[`${kind}Cookies`]);
  assert.deepEqual(await snapshot(f.observer, f.groupId), deleted);
  const ledger = await call(t, "getLedgerForGroup", [f.groupId]);
  assert.equal(ledger.payments[0].allocations[0].excluded, true);
  assert.equal(ledger.balances.status, "ready");
  assert.ok(ledger.balances.members.every(row => row.net === "0.00"));
});

test("real persisted request keys never authenticate an owner, guest or foreign group", async t => {
  const f = await fixture(t); const key = randomUUID();
  await call(t, "createExpense", [f.owner, f.expense(), key], f.ownerCookies);
  const before = await snapshot(f.observer, f.groupId);
  const { rows: [otherGroup] } = await f.observer.query('INSERT INTO public."group" (name,currency,"createdBy","shareToken") VALUES ($1,$2,$3,$4) RETURNING id', ["Other owned test group", "GBP", f.userId, randomBytes(32).toString("base64url")]);
  await f.observer.query('INSERT INTO public."groupMember" ("groupId","userId",name,role,"claimedAt") VALUES ($1,$2,$3,$4,now())', [otherGroup.id, f.userId, "Owner", "OWNER"]);
  for (const [access, cookies, expected] of [[f.owner, {}, /access/], [f.guest, {}, /access/], [f.guest, f.guestCookies, /different expense/], [{ kind: "owner", groupId: 2147483647 }, f.ownerCookies, /access/]]) {
    const request = await worker(t, "createExpense", [access, f.expense(), key], cookies); request.start();
    const result = await request.result; assert.equal(result.ok, false); assert.match(result.message, expected);
  }
  const crossGroup = await worker(t, "createExpense", [{ kind: "owner", groupId: otherGroup.id }, f.expense(), key], f.ownerCookies);
  crossGroup.start(); const crossResult = await crossGroup.result;
  assert.equal(crossResult.ok, false); assert.match(crossResult.message, /different expense details/);
  assert.deepEqual(await snapshot(f.observer, f.groupId), before);
});

test("competing PostgreSQL payment requests cannot over-reserve the same debt", async t => {
  const f = await fixture(t);
  const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
  const requests = [payment(f, expense.id), payment(f, expense.id)];
  const results = await race(t, f.observer, f.groupId,
    ["createPayment", [f.guest, requests[0]], f.guestCookies], ["createPayment", [f.guest, requests[1]], f.guestCookies]);
  assert.deepEqual(results.map(row => row.ok), [true, false]);
  assert.match(results[1].message, /remaining|available/);
  const rows = await snapshot(f.observer, f.groupId);
  assert.equal(rows.payment.length, 1); assert.equal(rows.payment[0].status, "SENT"); assert.equal(rows.payment[0].amount, "7.00");
  assert.equal(rows.allocations.length, 1); assert.equal(rows.allocations[0].amountPence, "700");
  assert.equal(eventCount(rows, "PAYMENT_SENT"), 1);
  const ledger = await call(t, "getLedgerForGroup", [f.groupId]);
  assert.equal(ledger.balances.members.find(row => row.id === f.guestId).net, "-10.00");
});

for (const first of ["delete", "confirm"]) test(`expense deletion/payment confirmation: ${first} owns lock first`, async t => {
  const f = await fixture(t);
  const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
  const reported = await call(t, "createPayment", [f.guest, payment(f, expense.id, "10")], f.guestCookies);
  const saved = await call(t, "getSavedExpenseForOwner", [f.groupId, expense.id], f.ownerCookies);
  const ledger = await call(t, "getLedgerForGroup", [f.groupId]);
  const remove = ["deleteSavedExpense", [f.groupId, expense.id, saved.version], f.ownerCookies];
  const confirm = ["reviewPayment", [f.owner, String(reported.id), "confirm", ledger.payments[0].allocationVersion], f.ownerCookies];
  const results = await race(t, f.observer, f.groupId, ...(first === "delete" ? [remove, confirm] : [confirm, remove]));
  assert.equal(results[0].ok, true, results[0].message);
  assert.equal(results[1].ok, first === "confirm", results[1].message);
  if (first === "delete") assert.match(results[1].message, /changed|excluded/);
  const rows = await snapshot(f.observer, f.groupId);
  assert.ok(rows.expense[0].deletedAt); assert.equal(rows.payment[0].status, first === "confirm" ? "CONFIRMED" : "SENT");
  assert.equal(rows.allocations.length, 1); assert.equal(rows.allocations[0].amountPence, "1000");
  assert.equal(eventCount(rows, "EXPENSE_DELETED"), 1); assert.equal(eventCount(rows, "PAYMENT_ALLOCATION_EXCLUDED"), 1);
  assert.equal(eventCount(rows, "PAYMENT_CONFIRMED"), first === "confirm" ? 1 : 0);
  const after = await call(t, "getLedgerForGroup", [f.groupId]);
  assert.equal(after.payments[0].allocations[0].excluded, true);
  assert.ok(after.balances.members.every(row => row.net === "0.00"));
});

for (const operation of ["expense", "payment", "claim"]) for (const deleteFirst of [true, false]) {
  test(`group deletion versus ${operation}: ${deleteFirst ? "deletion" : "creation"} owns lock first`, async t => {
    const f = await fixture(t);
    const expense = await call(t, "createExpense", [f.owner, f.expense(), randomUUID()], f.ownerCookies);
    const requests = {
      expense: ["createExpense", [f.guest, f.expense(), randomUUID()], f.guestCookies],
      payment: ["createPayment", [f.guest, payment(f, expense.id)], f.guestCookies],
      claim: ["claimMember", [f.shareToken, f.unclaimedId], {}],
    };
    const deletion = ["deleteGroupForOwner", [f.groupId], f.ownerCookies];
    const results = await race(t, f.observer, f.groupId, ...(deleteFirst ? [deletion, requests[operation]] : [requests[operation], deletion]));
    assert.equal(results[0].ok, true, results[0].message);
    assert.equal(results[1].ok, !deleteFirst, results[1].message);
    const rows = await snapshot(f.observer, f.groupId);
    assert.ok(Object.values(rows).every(table => table.length === 0));
    // Direct child lookups also catch orphans that group joins would hide.
    assert.equal((await f.observer.query('SELECT count(*)::int AS count FROM public."guestSession" WHERE "groupMemberId"=ANY($1::int[])', [[f.ownerId, f.guestId, f.unclaimedId]])).rows[0].count, 0);
    assert.equal((await f.observer.query('SELECT count(*)::int AS count FROM public."expenseParticipant" WHERE "expenseId"=$1', [expense.id])).rows[0].count, 0);
    assert.equal((await f.observer.query('SELECT count(*)::int AS count FROM public."user" WHERE id=$1', [f.userId])).rows[0].count, 1);
    const orphans = await f.observer.query(`SELECT
      (SELECT count(*) FROM public."expenseParticipant" s LEFT JOIN public.expense e ON e.id=s."expenseId" WHERE e.id IS NULL) +
      (SELECT count(*) FROM public."paymentAllocation" a LEFT JOIN public.payment p ON p.id=a."paymentId" LEFT JOIN public.expense e ON e.id=a."expenseId" WHERE p.id IS NULL OR e.id IS NULL) +
      (SELECT count(*) FROM public."guestSession" s LEFT JOIN public."groupMember" m ON m.id=s."groupMemberId" WHERE m.id IS NULL) AS count`);
    assert.equal(orphans.rows[0].count, "0");
    const denied = await worker(t, "createExpense", [f.guest, f.expense(), randomUUID()], f.guestCookies); denied.start();
    assert.equal((await denied.result).ok, false);
  });
}
