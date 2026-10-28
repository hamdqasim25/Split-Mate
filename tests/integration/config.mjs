import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parse } from "dotenv";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const localDirectory = resolve(root, ".integration-postgres");
export const databaseName = "splitmate_integration";
export const databaseUser = "splitmate_test";
export const databaseMarker = "splitmate-integration-only-v1";
export const targetMigration = "20261025T1709_expense_request_keys";

function endpoint(url) {
  const host = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? "loopback" : url.hostname;
  return `${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`;
}

/** Never put a connection string in errors or diagnostics. */
export function validateTestURL(value, applicationURLs = []) {
  if (!value) throw new Error("TEST_DATABASE_URL is required; application credentials are never a fallback. Run npm run test:db:start.");
  let url;
  try { url = new URL(value); } catch { throw new Error("Invalid test database configuration."); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || !url.port || Number(url.port) < 1024 || url.port === "5432"
    || url.pathname !== `/${databaseName}` || decodeURIComponent(url.username) !== databaseUser
    || !url.password || url.search || url.hash) {
    throw new Error("Test database must use 127.0.0.1, a dedicated non-default port, splitmate_integration and splitmate_test, with a password and no URL options.");
  }
  for (const value of applicationURLs.filter(Boolean)) {
    let application;
    try { application = new URL(value); } catch { throw new Error("Cannot validate application/test database separation."); }
    if (endpoint(application) === endpoint(url) || (application.username === url.username && application.password === url.password)) {
      throw new Error("Refusing application database target or reused application credentials.");
    }
  }
  return value;
}

export function testConfig() {
  const localFile = resolve(localDirectory, "test.env");
  const local = existsSync(localFile) ? parse(readFileSync(localFile)) : {};
  // Explicit environment always wins, including an empty value (fail closed).
  const value = process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL;
  const applicationURLs = [process.env.DATABASE_URL, process.env.DIRECT_URL];
  for (const filename of [".env", ".env.local", ".env.development", ".env.production", ".env.production.local", ".env.development.local"]) {
    const path = resolve(root, filename);
    if (existsSync(path)) {
      const env = parse(readFileSync(path));
      applicationURLs.push(env.DATABASE_URL, env.DIRECT_URL);
    }
  }
  return { url: validateTestURL(value, applicationURLs) };
}

export async function assertTestDatabase(client) {
  const { rows: [row] } = await client.query("SELECT current_database() AS db, current_user AS username, shobj_description(oid, 'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
  if (row?.db !== databaseName || row.username !== databaseUser || row.marker !== databaseMarker) {
    throw new Error("Database identity/opt-in marker mismatch: refusing integration operations.");
  }
}
