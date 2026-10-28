import pg from "pg";
import postgres from "@prisma/orm-postgres/runtime";
import contractJson from "../../src/prisma/contract.json" with { type: "json" };
import { testConfig, assertTestDatabase } from "./config.mjs";
let jar = {};
export function setCookies(value) { jar = value ?? {}; }
export async function cookies() { return { get: name => jar[name] ? { value: jar[name] } : undefined }; }

export const pool = new pg.Pool({ connectionString: testConfig().url, max: 1,
  application_name: process.env.SPLITMATE_TEST_WORKER,
  connectionTimeoutMillis: 5000, statement_timeout: 12000, lock_timeout: 10000 });
await assertTestDatabase(pool);
export const db = postgres({ contractJson, pg: pool });
// Warm the RC runtime's marker check before a transaction borrows this worker's
// sole connection. Marker verification stays enabled; no extra pool slot is needed.
await db.orm.public.User.select("id").first();
