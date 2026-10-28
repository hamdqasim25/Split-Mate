import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { testConfig, assertTestDatabase } from "./config.mjs";
const children = new WeakMap();
export async function stopWorkers(t) {
  await Promise.all((children.get(t) ?? []).map(async ({ child, exited, timer }) => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited; clearTimeout(timer);
  }));
}

export async function connection() {
  const client = new pg.Client({ connectionString: testConfig().url, application_name: "splitmate_test_observer",
    connectionTimeoutMillis: 5000, statement_timeout: 12000, lock_timeout: 10000 });
  await client.connect();
  try { await assertTestDatabase(client); return client; } catch (error) { await client.end(); throw error; }
}
export async function waitFor(label, probe, timeout = 8000) {
  const deadline = Date.now() + timeout;
  do {
    const value = await probe(); if (value) return value;
    await new Promise(done => setTimeout(done, 25));
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label} (${timeout}ms); contention was not established.`);
}
export async function worker(t, operation, args, cookies = {}) {
  const label = `smit_${randomUUID()}`;
  const child = fork(new URL("./worker.mjs", import.meta.url), [], { windowsHide: true,
    env: { ...process.env, TEST_DATABASE_URL: testConfig().url, SPLITMATE_TEST_WORKER: label },
    stdio: ["ignore", "pipe", "pipe", "ipc"], serialization: "advanced" });
  // Never print worker stderr: driver exceptions can contain connection details.
  child.stdout.resume(); child.stderr.resume();
  let readyResolve, readyReject, resultResolve, completed;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  const result = new Promise(resolve => { resultResolve = resolve; });
  const exited = new Promise(resolve => child.once("exit", resolve));
  const timer = setTimeout(() => {
    child.kill(); readyReject(new Error(`Worker startup/operation timeout: ${operation}`));
    resultResolve({ ok: false, message: `Worker timeout: ${operation}` });
  }, 20000);
  const owned = children.get(t) ?? []; owned.push({ child, exited, timer }); children.set(t, owned);
  child.on("error", () => { readyReject(new Error("Integration worker could not start")); resultResolve({ ok: false, message: "Worker failed" }); });
  child.on("exit", code => {
    clearTimeout(timer);
    readyReject(new Error(`Integration worker exited before ready (${code}); check test database/schema configuration.`));
    resultResolve({ ok: false, message: `Worker exited before result (${code})` });
  });
  child.on("message", message => { if (message.ready) readyResolve(message.pid); else { completed = message; resultResolve(message); } });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill(); await exited; clearTimeout(timer); });
  const pid = await ready;
  return { label, pid, result, get completed() { return completed; }, start() { child.send({ operation, args, cookies }); } };
}
export async function call(t, operation, args, cookies) {
  const request = await worker(t, operation, args, cookies); request.start();
  const result = await request.result;
  assert.equal(result.ok, true, `${operation}: ${result.message ?? result.code ?? "failed"}`);
  return result.value;
}

/** Hold an actual advisory lock inside A's AFTER UPDATE trigger while it owns
 * the group row lock. Start B, observe its blocking PID, then release A. */
export async function race(t, observer, groupId, first, second) {
  const controller = await connection();
  const a = await worker(t, ...first); const b = await worker(t, ...second);
  assert.notEqual(a.pid, b.pid, "competing operations must use different PostgreSQL backends");
  const gate = Math.floor(Math.random() * 1_000_000_000) + 1; // coordination ID, not a credential
  try {
    await controller.query("SELECT pg_advisory_lock(718204, $1)", [gate]);
    await observer.query('INSERT INTO splitmate_test_control.gates (worker, "groupId", gate) VALUES ($1,$2,$3)', [a.label, groupId, gate]);
    a.start();
    await waitFor("first transaction to reach its PostgreSQL gate", async () => {
      if (a.completed) throw new Error(`First operation ended before contention: ${JSON.stringify(a.completed)}`);
      const { rows: [row] } = await observer.query("SELECT wait_event FROM pg_stat_activity WHERE pid=$1", [a.pid]);
      return row?.wait_event === "advisory";
    });
    b.start();
    await waitFor("second transaction blocked by the first group lock", async () => {
      const { rows: [row] } = await observer.query("SELECT $1::int = ANY(pg_blocking_pids($2)) AS blocked", [a.pid, b.pid]);
      return row?.blocked;
    });
    t.diagnostic(`${first[0]} backend ${a.pid} blocked ${second[0]} backend ${b.pid}; observed with pg_blocking_pids`);
    await controller.query("SELECT pg_advisory_unlock(718204, $1)", [gate]);
    return await Promise.all([a.result, b.result]);
  } finally {
    await controller.query("SELECT pg_advisory_unlock_all()").catch(() => {});
    await controller.end();
    await observer.query("DELETE FROM splitmate_test_control.gates WHERE worker=$1", [a.label]);
  }
}
