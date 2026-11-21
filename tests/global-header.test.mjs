import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { getVisitorState } = await import("../src/lib/auth/visitor.ts");
const { default: Header } = await import("../src/components/app-header.tsx");
hooks.deregister();
const original = process.env.NODE_ENV;
beforeEach(() => { reset(); process.env.NODE_ENV = "development"; });
afterEach(() => { if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original; });
function guest() {
 state.rows.GroupMember[0].claimedAt = new Date().toISOString();
 state.rows.GuestSession.push({ id: 1, groupMemberId: 2, expiresAt: new Date(Date.now()+60000).toISOString(), tokenHash: createHash("sha256").update(token).digest("hex") });
 state.cookies.set("splitmate_guest_session", token);
}
function owner() {
 state.rows.User.push({ id: 7, name: "Private name", email: "private@example.com", passwordHash: "PRIVATE_HASH" });
 state.rows.UserSession.push({ id: 1, userId: 7, expiresAt: new Date(Date.now()+60000).toISOString(), tokenHash: createHash("sha256").update(token).digest("hex") });
 state.cookies.set("splitmate_owner_session", token);
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : []; }
for (const visitor of ["owner", "guest", "signed-out"]) test(`global header supplies ${visitor} navigation and one accessible home link`, async () => {
 if (visitor === "owner") owner(); if (visitor === "guest") guest();
 const tree = await Header(); const all = nodes(tree);
 assert.equal(all.find(n => n.type?.name === "AccountMenu").props.visitor, visitor);
 assert.ok(all.some(n => n.type?.name === "ThemeToggle"));
 assert.equal(all.filter(n => n.props?.href === "/").length, 1);
 assert.equal(all.find(n => n.props?.href === "/").props["aria-label"], "SPLITMate home");
 assert.doesNotMatch(JSON.stringify(tree), /Private name|private@example|PRIVATE_HASH|tokenHash/);
 assert.deepEqual(state.writes, []);
});
test("owner wins over guest without reading guest records", async () => { owner(); guest(); assert.equal(await getVisitorState(), "owner"); assert.ok(!state.readOperations.some(value => value.startsWith("GuestSession"))); });
for (const kind of ["expired", "revoked", "inactive", "unclaimed", "linked", "missing-group", "malformed", "production-local"]) test(`invalid guest ${kind} cannot produce privileged navigation`, async () => {
 guest();
 if (kind === "expired") state.rows.GuestSession[0].expiresAt = new Date(0).toISOString();
 if (kind === "revoked") state.rows.GuestSession = [];
 if (kind === "inactive") state.rows.GroupMember[0].isActive = false;
 if (kind === "unclaimed") state.rows.GroupMember[0].claimedAt = null;
 if (kind === "linked") state.rows.GroupMember[0].userId = 7;
 if (kind === "missing-group") state.rows.Group = [];
 if (kind === "malformed") state.cookies.set("__Host-splitmate_guest_session", "bad");
 if (kind === "production-local") process.env.NODE_ENV = "production";
 assert.equal(await getVisitorState(), "signed-out");
});
test("revoked owner may retain valid guest presentation without owner privilege", async () => { owner(); guest(); state.rows.UserSession = []; assert.equal(await getVisitorState(), "guest"); });
test("root layout provides header for every route including public pages", () => {
 const layout = readFileSync("src/app/layout.tsx", "utf8");
 assert.match(layout, /<AppHeader \/>/);
 assert.ok(layout.indexOf("<AppHeader") < layout.indexOf("{children}"));
 assert.doesNotMatch(layout, /account-menu-slot/);
});
