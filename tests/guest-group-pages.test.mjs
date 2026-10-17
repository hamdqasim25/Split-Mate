import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { default: GroupPage } = await import("../src/app/g/[shareToken]/group/page.tsx");
const { default: SignOut } = await import("../src/components/groups/guest-sign-out.tsx");
const { default: ExpenseList } = await import("../src/components/expenses/expense-list.tsx");
const { default: MemberList } = await import("../src/components/groups/member-list.tsx");
const { default: ActivityList } = await import("../src/components/groups/activity-list.tsx");
const { claimGuest, signOutGuest } = await import("../src/app/actions/guest.ts");
hooks.deregister();
beforeEach(reset);
const props = (shareToken = token) => ({ params: Promise.resolve({ shareToken }) });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  if ([MemberList, ActivityList].includes(tree.type)) return [tree, ...nodes(tree.type(tree.props))];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if ([MemberList, ActivityList].includes(tree?.type)) return text(tree.type(tree.props));
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
async function join() {
  const form = new FormData(); form.set("memberId", "2");
  await assert.rejects(claimGuest(token, { error: "" }, form), { destination: `/g/${token}/group` });
}
test("valid guest sees identity, joined/waiting members, activity and future expenses", async () => {
  await join();
  state.rows.GroupMember.push({ ...state.rows.GroupMember[0], id: 3, name: "Waiting guest", claimedAt: null });
  const tree = await GroupPage(props());
  const content = text(tree);
  for (const expected of ["Football", "You're joined as Jaher", "Jaher(You)", "Waiting guest", "Joined", "Waiting", "Recent activity", "Jaher joined the group"]) assert.ok(content.includes(expected), expected);
  const expenses = nodes(tree).find(node => node.type === ExpenseList);
  assert.match(text(ExpenseList(expenses.props)), /No expenses yet/);
  assert.ok(nodes(tree).some(node => node.type === SignOut));
  assert.ok(nodes(tree).some(node => node.type === "time" && node.props.dateTime));
  assert.ok(nodes(tree).some(node => node.props.href === `/g/${token}/expenses/new`));
  assert.ok(!content.includes(token));
  assert.ok(!nodes(tree).some(node => node.type === "button"), "no fake expense action");
});
test("missing session redirects before private group reads", async () => {
  await assert.rejects(GroupPage(props()), { destination: `/g/${token}` });
  assert.ok(!state.readOperations.some(op => op.endsWith(".all")));
});
test("malformed URL redirects to a fixed safe route", async () => {
  await assert.rejects(GroupPage(props("//evil.example")), { destination: "/g/invalid" });
  assert.equal(state.reads, 0);
});
test("expired session and cross-group URL redirect without data", async () => {
  await join();
  const otherToken = Buffer.alloc(32, 3).toString("base64url");
  state.rows.Group.push({ id: 2, name: "Other group", shareToken: otherToken, shareLinkEnabled: true });
  await assert.rejects(GroupPage(props(otherToken)), { destination: `/g/${otherToken}` });
  state.rows.GuestSession[0].expiresAt = "2000-01-01T00:00:00Z";
  await assert.rejects(GroupPage(props()), { destination: `/g/${token}` });
  assert.equal(state.cookieWrites.length, 1, "Server Components do not clear cookies during rendering");
});
test("disabled link preserves authenticated page access and empty activity state", async () => {
  await join(); state.rows.Group[0].shareLinkEnabled = false; state.rows.ActivityEvent = [];
  assert.match(text(await GroupPage(props())), /No activity yet/);
});
test("database failure shows a generic page without private data", async () => {
  await join(); state.failAt = "ActivityEvent.all";
  const content = text(await GroupPage(props()));
  assert.match(content, /Group temporarily unavailable/);
  assert.doesNotMatch(content, /PRIVATE_DATABASE_DETAILS|Football|Jaher/);
});
test("sign-out action revokes browser session and leaves identity claimed", async () => {
  await join();
  await assert.rejects(signOutGuest(token, { error: "" }), { destination: `/g/${token}` });
  assert.equal(state.rows.GuestSession.length, 0);
  assert.ok(state.rows.GroupMember[0].claimedAt);
  assert.equal(state.rows.GroupMember[0].isActive, true);
  await assert.rejects(GroupPage(props()), { destination: `/g/${token}` });
  const form = new FormData(); form.set("memberId", "2");
  assert.ok((await claimGuest(token, { error: "" }, form)).error, "sign-out does not reopen claiming");
});
test("sign-out failure retains session and returns safe error", async () => {
  await join(); state.failAt = "GuestSession.delete";
  const result = await signOutGuest(token, { error: "" });
  assert.match(result.error, /Unable to sign out/);
  assert.doesNotMatch(result.error, /PRIVATE/);
  assert.equal(state.rows.GuestSession.length, 1);
});
test("sign-out ignores manipulated redirect paths", async () => {
  await assert.rejects(signOutGuest("//evil.example", { error: "" }), { destination: "/g/invalid" });
});
test("sign-out UI explains claim retention and provides pending/error feedback", () => {
  let tree = SignOut({ shareToken: token });
  assert.match(text(tree), /name stays claimed/);
  assert.match(text(tree), /Session recovery is not available/);
  assert.equal(nodes(tree).find(node => node.type === "button").props["aria-describedby"], "guest-sign-out-help");
  state.pending = true; state.actionState = { error: "Unable to sign out." };
  tree = SignOut({ shareToken: token });
  assert.equal(nodes(tree).find(node => node.type === "button").props.disabled, true);
  assert.match(text(tree), /Signing out/);
  assert.equal(text(nodes(tree).find(node => node.props.role === "alert")), "Unable to sign out.");
});
