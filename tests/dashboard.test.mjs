import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { beforeEach, test } from "node:test";
import ts from "typescript";

// A read-only query double evaluates predicates, projections, ordering and limits.
// Import interception ensures these tests cannot reach the cloud database.
const mockUrl = `data:text/javascript,${encodeURIComponent(`
export const state = { rows: {}, reads: [], user: null, failure: null };
export async function getCurrentUser() { return state.user; }
export function redirect(destination) { throw Object.assign(new Error('redirect'), { destination }); }
export default function Link() {}
const fields = new Proxy({}, { get: (_, key) => ({
  in: values => row => values.includes(row[key]),
  desc: () => ({ key, direction: -1 }),
}) });
function collection(model, options = {}) {
  const next = patch => collection(model, { ...options, ...patch });
  return {
    where(filter) {
      const predicate = typeof filter === 'function' ? filter(fields)
        : row => Object.entries(filter).every(([key, value]) => row[key] === value);
      return next({ filters: [...(options.filters ?? []), predicate] });
    },
    select(...selection) { return next({ selection }); },
    include(relation, refine) {
      if (model !== 'Group' || relation !== 'members') throw new Error('Unexpected relation');
      return next({ memberCount: refine(collection('GroupMember')) });
    },
    count() { return { filters: options.filters ?? [] }; },
    orderBy(callbacks) { return next({ order: callbacks.map(callback => callback(fields)) }); },
    limit(limit) { return next({ limit }); },
    async all() {
      state.reads.push({ model, ...options });
      if (state.failure) throw state.failure;
      let rows = state.rows[model].filter(row => (options.filters ?? []).every(predicate => predicate(row)));
      rows.sort((a, b) => {
        for (const { key, direction } of options.order ?? []) {
          const comparison = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
          if (comparison) return direction * comparison;
        }
        return 0;
      });
      if (options.limit !== undefined) rows = rows.slice(0, options.limit);
      return rows.map(row => ({
        ...Object.fromEntries(options.selection.map(key => [key, row[key]])),
        ...(options.memberCount && { members: state.rows.GroupMember.filter(member =>
          member.groupId === row.id && options.memberCount.filters.every(predicate => predicate(member))).length }),
      }));
    },
  };
}
export const db = { orm: { public: { Group: collection('Group'), ActivityEvent: collection('ActivityEvent') } } };
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (["@/prisma/db", "@/lib/auth/session", "next/navigation", "next/link"].includes(specifier)) {
      return { url: mockUrl, shortCircuit: true };
    }
    if (specifier === "server-only") return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "@/data/groups") return { url: new URL("../src/data/groups.ts", import.meta.url).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
      }).outputText,
    };
    return nextLoad(url, context);
  },
});
const { state } = await import(mockUrl);
const { getGroupsForOwner } = await import("../src/data/groups.ts");
const { default: Dashboard } = await import("../src/app/dashboard/page.tsx");
hooks.deregister();

beforeEach(() => {
  state.reads = [];
  state.user = { id: 7, name: "Test Owner" };
  state.failure = null;
  state.rows = {
    Group: [
      { id: 1, createdBy: 7, name: "Older group", description: null, currency: "GBP", createdAt: "2026-09-01T12:00:00Z", shareToken: "secret-token" },
      { id: 2, createdBy: 7, name: "Newest group", description: "A real description", currency: "GBP", createdAt: "2026-09-02T12:00:00Z", shareToken: "secret-token" },
      { id: 3, createdBy: 9, name: "Other owner's group", description: null, currency: "GBP", createdAt: "2026-09-03T12:00:00Z", shareToken: "other-secret" },
    ],
    GroupMember: [
      { groupId: 1, userId: 7, isActive: true },
      { groupId: 1, userId: null, isActive: true },
      { groupId: 1, userId: null, isActive: false },
      { groupId: 3, userId: 7, isActive: true },
    ],
    ActivityEvent: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1, groupId: index === 7 ? 3 : index % 2 + 1,
      description: index === 7 ? "Other owner's private event" : "Test Owner created the group",
      createdAt: `2026-09-0${index + 1}T12:00:00Z`, memberId: 100, entityType: "GROUP",
    })),
  };
});

for (const id of [0, -1, 1.5, NaN, Infinity, 2_147_483_648, "7", null, undefined]) {
  test(`rejects invalid owner ID ${String(id)} before querying`, async () => {
    await assert.rejects(getGroupsForOwner(id), RangeError);
    assert.equal(state.reads.length, 0);
  });
}
test("only owned groups and their newest five events are returned", async () => {
  const { groups, activity } = await getGroupsForOwner(7);
  assert.deepEqual(groups.map(group => group.id), [2, 1]);
  assert.deepEqual(activity.map(event => event.id), [7, 6, 5, 4, 3]);
  assert.ok(activity.every(event => [1, 2].includes(event.groupId)));
  assert.equal(state.reads.length, 2);
  assert.equal(state.reads[1].limit, 5);
});
test("counts only active members, including guests, and returns zero for an empty group", async () => {
  const { groups } = await getGroupsForOwner(7);
  assert.deepEqual(groups.map(group => group.members), [0, 2]);
});
test("selects only dashboard fields and never returns share tokens or identity secrets", async () => {
  const result = await getGroupsForOwner(7);
  assert.deepEqual(Object.keys(result.groups[0]).sort(), ["createdAt", "currency", "description", "id", "members", "name"]);
  assert.deepEqual(Object.keys(result.activity[0]).sort(), ["createdAt", "description", "groupId", "id"]);
  assert.doesNotMatch(JSON.stringify(result), /secret|shareToken|password|userId|memberId/);
});
test("uses IDs to break timestamp ties deterministically", async () => {
  state.rows.Group[0].createdAt = state.rows.Group[1].createdAt;
  state.rows.ActivityEvent.forEach(event => { event.createdAt = "2026-09-01T12:00:00Z"; });
  const result = await getGroupsForOwner(7);
  assert.deepEqual(result.groups.map(group => group.id), [2, 1]);
  assert.deepEqual(result.activity.map(event => event.id), [7, 6, 5, 4, 3]);
});
test("no owned groups skips the activity query", async () => {
  assert.deepEqual(await getGroupsForOwner(88), { groups: [], activity: [] });
  assert.equal(state.reads.length, 1);
});
test("database failures propagate rather than pretending the dashboard is empty", async () => {
  state.failure = new Error("Database unavailable");
  await assert.rejects(getGroupsForOwner(7), state.failure);
});
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
test("unauthenticated dashboard redirects without any group queries", async () => {
  state.user = null;
  await assert.rejects(Dashboard(), { destination: "/login?next=/dashboard" });
  assert.equal(state.reads.length, 0);
});
test("dashboard uses the verified owner, renders real data and removes sample money", async () => {
  const output = text(await Dashboard());
  assert.match(output, /Welcome back,\s*Test Owner/);
  assert.match(output, /Newest group/);
  assert.match(output, /A real description/);
  assert.match(output, /Test Owner created the group/);
  assert.match(output, /Available once expenses are added/);
  assert.doesNotMatch(output, /Weekend Trip|Football|£40|£12|View all|Other owner's|secret-token/);
  state.user = { id: 9, name: "Another Owner" };
  const otherOutput = text(await Dashboard());
  assert.match(otherOutput, /Other owner's group/);
  assert.doesNotMatch(otherOutput, /Newest group/);
});
test("dashboard renders useful empty states", async () => {
  state.user = { id: 88, name: "New Owner" };
  const output = text(await Dashboard());
  assert.match(output, /No groups yet/);
  assert.match(output, /Create your first group/);
  assert.match(output, /No activity yet/);
});
