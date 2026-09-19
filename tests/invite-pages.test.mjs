import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { default: InvitePage } = await import("../src/app/g/[shareToken]/page.tsx");
const { default: JoinedPage } = await import("../src/app/g/[shareToken]/joined/page.tsx");
const { default: ClaimForm } = await import("../src/components/groups/claim-member-form.tsx");
const { claimGuest } = await import("../src/app/actions/guest.ts");
hooks.deregister();
beforeEach(reset);
const props = (shareToken = token) => ({ params: Promise.resolve({ shareToken }) });
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
function submit(memberId = "2", shareToken = token) {
  const form = new FormData(); form.set("memberId", memberId);
  return claimGuest(shareToken, { error: "" }, form);
}
test("public invite displays group and claimable member actions", async () => {
  const tree = await InvitePage(props());
  assert.match(text(tree), /Football/);
  const form = nodes(tree).find(node => node.type === ClaimForm);
  assert.deepEqual(form.props.members, [{ id: 2, name: "Jaher" }]);
  const rendered = ClaimForm(form.props);
  assert.match(text(rendered), /Continue as Jaher/);
  assert.doesNotMatch(text(tree), new RegExp(token));
});
test("invalid, disabled and empty invite states", async () => {
  assert.match(text(await InvitePage(props("bad"))), /invalid or unavailable/);
  state.rows.Group[0].shareLinkEnabled = false;
  const disabled = text(await InvitePage(props()));
  assert.match(disabled, /no longer active/); assert.doesNotMatch(disabled, /Football|Jaher/);
  state.rows.Group[0].shareLinkEnabled = true;
  state.rows.GroupMember = [];
  assert.match(text(await InvitePage(props())), /no unclaimed member identities/);
});
test("successful action and returning guests go to group without duplicating sessions", async () => {
  await assert.rejects(submit(), { destination: `/g/${token}/group` });
  await assert.rejects(JoinedPage(props()), { destination: `/g/${token}/group` });
  await assert.rejects(InvitePage(props()), { destination: `/g/${token}/group` });
  await assert.rejects(submit(), { destination: `/g/${token}/group` });
  assert.equal(state.rows.GuestSession.length, 1);
  assert.equal(state.rows.ActivityEvent.length, 1);
});
test("disabled invitations preserve existing guest access but block new claims", async () => {
  await assert.rejects(submit(), { destination: `/g/${token}/group` });
  state.rows.Group[0].shareLinkEnabled = false;
  await assert.rejects(InvitePage(props()), { destination: `/g/${token}/group` });
  await assert.rejects(submit(), { destination: `/g/${token}/group` });
  assert.equal(state.rows.GuestSession.length, 1);
  state.cookies.clear();
  assert.ok((await submit()).error);
  assert.match(text(await InvitePage(props())), /no longer active/);
});
test("old confirmation links redirect safely without rendering group data", async () => {
  await assert.rejects(JoinedPage(props()), { destination: `/g/${token}/group` });
  await assert.rejects(JoinedPage(props("//evil.example")), { destination: "/g/invalid" });
});
test("manipulated member and invite inputs return safe errors", async () => {
  for (const id of ["99", "2e0", "-1", "2147483648"]) assert.ok((await submit(id)).error);
  assert.ok((await submit("2", "bad")).error);
  assert.equal(state.cookieWrites.length, 0);
});
test("database failure returns generic error and never issues cookie", async () => {
  state.failAt = "ActivityEvent.create";
  const result = await submit();
  assert.match(result.error, /Unable to join/);
  assert.doesNotMatch(result.error, /PRIVATE/);
  assert.equal(state.cookieWrites.length, 0);
  assert.equal(state.rows.GroupMember[0].claimedAt, null);
});
test("claim form exposes pending and accessible error states", () => {
  state.pending = true; state.actionState = { error: "Choose another name." };
  const tree = ClaimForm({ shareToken: token, members: [{ id: 2, name: "Jaher" }] });
  assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, true);
  assert.match(text(nodes(tree).find(node => node.props.role === "status")), /Joining/);
  assert.equal(text(nodes(tree).find(node => node.props.role === "alert")), "Choose another name.");
});
