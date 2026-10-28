import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { connection } from "./harness.mjs";
import { cleanupRun } from "./fixtures.mjs";
import { root, localDirectory, testConfig, targetMigration } from "./config.mjs";

const mode = process.argv[2];
let client;
try {
  const { url } = testConfig();
  client = await connection(); // Live identity marker check before CLI migrations or tests.
  async function prisma(args) {
    const output = await new Promise((done, reject) => {
      const child = spawn(process.execPath, [join(root, "node_modules/prisma/dist/prisma.js"), ...args, "--config", "prisma.integration.config.ts"], {
        cwd: root, windowsHide: true, env: { ...process.env, TEST_DATABASE_URL: url }, stdio: ["ignore", "pipe", "pipe"],
      });
      let text = ""; child.stdout.on("data", chunk => { text += chunk; }); child.stderr.on("data", chunk => { text += chunk; });
      const timeout = setTimeout(() => { child.kill(); reject(new Error("Test migration/verification command timed out.")); }, 60000);
      child.on("error", () => { clearTimeout(timeout); reject(new Error("Could not launch local Prisma CLI.")); });
      child.on("exit", code => { clearTimeout(timeout); done({ code, text }); });
    });
    const safe = output.text.replaceAll(url, "[TEST_DATABASE_URL]").replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[DATABASE_URL]");
    mkdirSync(localDirectory, { recursive: true });
    writeFileSync(join(localDirectory, `prisma-${args.slice(0,2).join("-")}${args.includes("--show") ? "-preview" : ""}.log`), safe);
    const results = safe.split(/\r?\n/).flatMap(line => {
      try { const event = JSON.parse(line); return event.kind === "result" ? [event.envelope] : []; } catch { return []; }
    });
    for (const result of results) console.log(`${result.commandId}: ${result.result?.summary ?? (result.ok ? "passed" : "failed")}`);
    if (output.code !== 0) console.error(safe);
    if (output.code !== 0) throw new Error(`Test Prisma ${args.slice(0,2).join(" ")} failed. No application connection was used.`);
  }
  const verify = async () => {
    await prisma(["migration", "status"]);
    await prisma(["db", "verify", "--schema-only"]);
    await prisma(["db", "verify"]);
  };
  if (mode === "preview") {
    await prisma(["migration", "status"]);
    await prisma(["db", "migrate", "--show", "--to", targetMigration]);
  } else if (mode === "migrate") {
    await prisma(["db", "migrate", "--show", "--to", targetMigration]);
    await prisma(["db", "migrate", "--to", targetMigration]);
    await verify();
  } else if (mode === "verify") await verify();
  else if (mode === "cleanup") {
    await client.query("SELECT pg_advisory_lock(718203,1)");
    const exists = await client.query("SELECT to_regclass('splitmate_test_control.runs') AS table");
    if (exists.rows[0].table) {
      const { rows } = await client.query("SELECT id FROM splitmate_test_control.runs ORDER BY created_at");
      for (const row of rows) await cleanupRun(client, row.id);
      console.log(`Cleaned ${rows.length} registered test fixture(s).`);
    }
  } else if (mode === "test") {
    await verify();
    await new Promise((done, reject) => {
      const child = spawn(process.execPath, ["--test", "--test-concurrency=1", "--test-reporter=spec", "tests/integration/concurrency.test.mjs", "tests/integration/rollback.test.mjs"], {
        cwd: root, windowsHide: true, env: { ...process.env, TEST_DATABASE_URL: url }, stdio: "inherit",
      });
      const timer = setTimeout(() => { child.kill(); reject(new Error("Integration suite exceeded 10 minutes.")); }, 600000);
      child.on("error", error => { clearTimeout(timer); reject(error); });
      child.on("exit", code => { clearTimeout(timer); if (code === 0) done(); else reject(new Error("Integration suite failed.")); });
    });
  } else throw new Error("Use preview, migrate, verify, test or cleanup.");
} catch (error) { console.error(error.code ? `Integration command failed (${error.code}).` : error.message); process.exitCode = 1; }
finally { if (client) await client.end(); }
