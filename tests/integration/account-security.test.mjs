import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { test } from "node:test";
import { fixture, cleanupRun } from "./fixtures.mjs";
import { call, race, worker } from "./harness.mjs";
const oldPassword = "original secure password";
const newPassword = "replacement secure password";
const originalHash = await bcrypt.hash(oldPassword, 12);
const payload = { currentPassword: oldPassword, newPassword, confirmPassword: newPassword };
async function setup(t) {
 const f = await fixture(t);
 await f.observer.query('UPDATE public."user" SET "passwordHash"=$1 WHERE id=$2', [originalHash, f.userId]);
 const { rows: [user] } = await f.observer.query('SELECT email FROM public."user" WHERE id=$1', [f.userId]);
 return { ...f, email: user.email };
}
async function sessions(f) { return (await f.observer.query('SELECT id FROM public."userSession" WHERE "userId"=$1', [f.userId])).rows; }
for (const first of ["login", "change"]) test(`account row lock: ${first} precedes overlapping old-password login/change`, async t => {
 const f = await setup(t);
 const login = ["loginUser", [{ email: f.email, password: oldPassword }, "http://localhost:3000"], {}];
 const change = ["changePassword", [payload], f.ownerCookies];
 const results = await race(t, f.observer, f.userId, ...(first === "login" ? [login, change] : [change, login]));
 assert.equal(results[0].ok, true);
 assert.equal(results[1].ok, first === "login");
 assert.equal((await sessions(f)).length, 0);
 await call(t, "authenticateUser", [{ email: f.email, password: newPassword }]);
 const rejected = await worker(t, "loginUser", [{ email: f.email, password: oldPassword }, "http://localhost:3000"]); rejected.start();
 assert.equal((await rejected.result).ok, false);
 await call(t, "loginUser", [{ email: f.email, password: newPassword }, "http://localhost:3000"]);
 assert.equal((await sessions(f)).length, 1);
});
test("two competing password changes allow only one commit and invalidate the original session", async t => {
 const f = await setup(t);
 const request = ["changePassword", [payload], f.ownerCookies];
 const results = await race(t, f.observer, f.userId, request, request);
 assert.deepEqual(results.map(r => r.ok), [true, false]);
 assert.equal((await sessions(f)).length, 0);
 const retry = await worker(t, ...request); retry.start(); assert.equal((await retry.result).ok, false);
});
test("session deletion failure rolls back password and sessions together", async t => {
 const f = await setup(t);
 const before = await sessions(f);
 const request = await worker(t, "changePassword", [payload], f.ownerCookies);
 await f.observer.query('INSERT INTO splitmate_test_control.faults (worker,"groupId",stage) VALUES ($1,$2,$3)', [request.label, f.userId, "owner_session_delete"]);
 try {
  request.start(); assert.equal((await request.result).ok, false);
  assert.deepEqual(await sessions(f), before);
  const { rows: [user] } = await f.observer.query('SELECT "passwordHash" FROM public."user" WHERE id=$1', [f.userId]);
  assert.equal(user.passwordHash, originalHash);
 } finally { await f.observer.query('DELETE FROM splitmate_test_control.faults WHERE worker=$1', [request.label]); }
});
test("account-wide revocation preserves unrelated owner and guest sessions", async t => {
 const f = await setup(t);
 const runId = randomUUID();
 const { rows: [other] } = await f.observer.query('INSERT INTO public."user" (name,email,"passwordHash") VALUES ($1,$2,$3) RETURNING id', ["Other test owner", `splitmate-it-${runId}@example.invalid`, originalHash]);
 await f.observer.query('INSERT INTO splitmate_test_control.runs (id,"ownerId") VALUES ($1,$2)', [runId, other.id]);
 try {
  await f.observer.query(`INSERT INTO public."userSession" ("userId","tokenHash","expiresAt") VALUES ($1,$2,now()+interval '1 hour')`, [other.id, createHash("sha256").update(randomBytes(32)).digest("hex")]);
  await call(t, "loginUser", [{ email: f.email, password: oldPassword }, "http://localhost:3000"]);
  assert.equal((await sessions(f)).length, 2);
  const guests = (await f.observer.query('SELECT * FROM public."guestSession" ORDER BY id')).rows;
  const unrelated = (await f.observer.query('SELECT * FROM public."userSession" WHERE "userId"=$1 ORDER BY id', [other.id])).rows;
  assert.equal(unrelated.length, 1);
  await call(t, "changePassword", [payload], f.ownerCookies);
  assert.equal((await sessions(f)).length, 0);
  assert.deepEqual((await f.observer.query('SELECT * FROM public."guestSession" ORDER BY id')).rows, guests);
  assert.deepEqual((await f.observer.query('SELECT * FROM public."userSession" WHERE "userId"=$1 ORDER BY id', [other.id])).rows, unrelated);
 } finally { await cleanupRun(f.observer, runId); }
});
