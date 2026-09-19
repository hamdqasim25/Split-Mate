import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";

export const token = Buffer.alloc(32, 1).toString("base64url");
export const state = {};
let queue = Promise.resolve();
export function reset() {
  queue = Promise.resolve();
  Object.assign(state, {
    rows: {
      Group: [{ id: 1, name: "Football", shareToken: token, shareLinkEnabled: true, createdBy: 7 }],
      GroupMember: [{ id: 2, groupId: 1, name: "Jaher", role: "MEMBER", userId: null, claimedAt: null, isActive: true }],
      GuestSession: [], ActivityEvent: [],
    },
    cookies: new Map(), cookieWrites: [], failAt: null, reads: 0, readOperations: [], writes: [], commits: 0, rollbacks: 0,
    actionState: { error: "" }, pending: false,
  });
}
const fieldProxy = new Proxy({}, { get: (_, key) => ({
  gt: value => row => row[key] > value,
  in: values => row => values.includes(row[key]),
  asc: () => ({ key, direction: 1 }),
  desc: () => ({ key, direction: -1 }),
}) });
function collection(model, getRows, fields, filters = [], order = [], limit = Infinity) {
  const predicate = value => typeof value === "function" ? value(fieldProxy)
    : row => Object.entries(value).every(([key, expected]) => row[key] === expected);
  const matches = row => filters.every(filter => filter(row));
  const project = row => row && (fields ? Object.fromEntries(fields.map(key => [key, row[key]])) : { ...row });
  function fail(operation) {
    if (state.failAt === `${model}.${operation}`) throw new Error("PRIVATE_DATABASE_DETAILS");
  }
  return {
    select: (...keys) => collection(model, getRows, keys, filters, order, limit),
    where: value => collection(model, getRows, fields, [...filters, predicate(value)], order, limit),
    orderBy: callbacks => collection(model, getRows, fields, filters,
      (Array.isArray(callbacks) ? callbacks : [callbacks]).map(callback => callback(fieldProxy)), limit),
    limit: value => collection(model, getRows, fields, filters, order, value),
    async first(value = {}) {
      state.reads++; fail("first");
      state.readOperations.push(`${model}.first`);
      return project(getRows()[model].find(row => matches(row) && predicate(value)(row)) ?? null);
    },
    async all() {
      state.reads++; fail("all"); state.readOperations.push(`${model}.all`);
      const rows = getRows()[model].filter(matches);
      rows.sort((a, b) => {
        for (const { key, direction } of order) {
          const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
          if (comparison) return comparison * direction;
        }
        return 0;
      });
      return rows.slice(0, limit).map(project);
    },
    async updateAll(values) {
      fail("updateAll");
      state.writes.push(`${model}.updateAll`);
      const rows = getRows()[model].filter(matches).map(row => { Object.assign(row, values); return project(row); });
      return rows;
    },
    async delete() {
      fail("delete"); state.writes.push(`${model}.delete`);
      const rows = getRows()[model];
      const index = rows.findIndex(matches);
      return index < 0 ? null : project(rows.splice(index, 1)[0]);
    },
    async create(values) {
      fail("create");
      const row = { id: getRows()[model].length + 1, ...values };
      getRows()[model].push(row); return project(row);
    },
  };
}
function orm(getRows) {
  return { public: Object.fromEntries(["Group", "GroupMember", "GuestSession", "ActivityEvent"].map(model => [model, collection(model, getRows)])) };
}
export const db = {
  orm: orm(() => state.rows),
  // Models lock serialization and rollback; this is not a real PostgreSQL race test.
  transaction(callback) {
    const run = queue.then(async () => {
      const staged = structuredClone(state.rows);
      try {
        const result = await callback({ orm: orm(() => staged) });
        state.rows = staged; state.commits++; return result;
      } catch (error) { state.rollbacks++; throw error; }
    });
    queue = run.catch(() => {});
    return run;
  },
};
export async function cookies() {
  return {
    get: name => state.cookies.has(name) ? { value: state.cookies.get(name) } : undefined,
    set(name, value, options) { state.cookies.set(name, value); state.cookieWrites.push({ name, value, options }); },
  };
}
export function redirect(destination) { throw Object.assign(new Error("redirect"), { destination }); }
export default function Link() {}
export function useActionState() { return [state.actionState, () => {}, state.pending]; }

export function installHooks() {
  return registerHooks({
    resolve(specifier, context, next) {
      if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
      if (["@/prisma/db", "next/headers", "next/navigation", "next/link"].includes(specifier)
        || (specifier === "react" && ["claim-member-form.tsx", "guest-sign-out.tsx"].some(file => context.parentURL?.endsWith(file)))) {
        return { url: import.meta.url, shortCircuit: true };
      }
      if (specifier.startsWith("@/")) {
        let url = new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url);
        if (!existsSync(url)) url = new URL(`../../src/${specifier.slice(2)}.tsx`, import.meta.url);
        return { url: url.href, shortCircuit: true };
      }
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith(".tsx")) return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
          compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
      return next(url, context);
    },
  });
}
