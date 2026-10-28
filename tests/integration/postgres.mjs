import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, realpathSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import pg from "pg";
import { localDirectory, databaseName, databaseUser, databaseMarker, validateTestURL } from "./config.mjs";

const port = 55439;
const data = join(localDirectory, "data");
const manifestPath = join(localDirectory, "cluster.json");
function binary(name) { return process.env.PG_BIN ? join(process.env.PG_BIN, `${name}${process.platform === "win32" ? ".exe" : ""}`) : name; }
async function command(name, args) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(binary(name), args, { windowsHide: true, stdio: "inherit" });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${name} timed out`)); }, 30000);
    child.on("error", error => { clearTimeout(timer); reject(new Error(`${name} failed (${error.code}); install PostgreSQL or set PG_BIN.`)); });
    child.on("exit", code => { clearTimeout(timer); if (code === 0) resolvePromise(); else reject(new Error(`${name} exited ${code}`)); });
  });
}
function ownedCluster() {
  if (!existsSync(manifestPath)) throw new Error("No owned integration cluster manifest; refusing to control another cluster.");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.data !== resolve(data) || manifest.port !== port || manifest.marker !== databaseMarker
    || (existsSync(data) && realpathSync(data) !== resolve(data))) throw new Error("Integration cluster path/ownership mismatch.");
  return manifest;
}
async function start() {
  mkdirSync(localDirectory, { recursive: true });
  if (!existsSync(manifestPath)) {
    if (existsSync(data)) throw new Error("Unrecognized data directory; refusing initialization.");
    const password = randomBytes(24).toString("hex");
    const url = `postgresql://${databaseUser}:${password}@127.0.0.1:${port}/${databaseName}`;
    validateTestURL(url);
    writeFileSync(manifestPath, JSON.stringify({ data: resolve(data), port, marker: databaseMarker }), { mode: 0o600, flag: "wx" });
    writeFileSync(join(localDirectory, "test.env"), `TEST_DATABASE_URL=${url}\n`, { mode: 0o600, flag: "wx" });
    const passwordFile = join(localDirectory, "init-password");
    writeFileSync(passwordFile, password, { mode: 0o600, flag: "wx" });
    try { await command("initdb", ["-D", data, "-U", databaseUser, "--pwfile", passwordFile, "-A", "scram-sha-256", "--encoding=UTF8", "--locale=C"]); }
    finally { unlinkSync(passwordFile); }
  }
  ownedCluster();
  if (!existsSync(join(data, "postmaster.pid"))) {
    // Refuse to share a port with any existing application/service.
    await new Promise((done, reject) => {
      const server = createServer(); server.once("error", reject); server.listen(port, "127.0.0.1", () => server.close(done));
    });
    await command("pg_ctl", ["-D", data, "-l", join(localDirectory, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "-t", "20", "start"]);
  }
  const { testConfig } = await import("./config.mjs");
  const config = testConfig();
  // Provision only this script's local endpoint, never a custom TEST_DATABASE_URL.
  if (new URL(config.url).port !== String(port)) throw new Error("Local setup requires its own port; unset TEST_DATABASE_URL for local provisioning.");
  const adminURL = new URL(config.url); adminURL.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminURL.toString(), connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    const existing = await client.query("SELECT shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname=$1", [databaseName]);
    if (!existing.rowCount) {
      await client.query(`CREATE DATABASE ${databaseName}`);
      await client.query(`COMMENT ON DATABASE ${databaseName} IS '${databaseMarker}'`);
    } else if (existing.rows[0].marker !== databaseMarker) throw new Error("Existing database lacks test ownership marker; refusing to adopt it.");
    console.log("Isolated PostgreSQL is ready on 127.0.0.1:55439. Credentials are in the ignored local test.env; none were printed.");
  } finally { await client.end(); }
}
try {
  if (process.argv[2] === "start") await start();
  else if (process.argv[2] === "stop") { ownedCluster(); await command("pg_ctl", ["-D", data, "-w", "-t", "20", "stop", "-m", "fast"]); }
  else throw new Error("Use start or stop. Data is retained; no cluster deletion command is provided.");
} catch (error) { console.error(error.code ? `PostgreSQL setup failed (${error.code}).` : error.message); process.exitCode = 1; }
