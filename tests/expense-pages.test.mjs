import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { default: OwnerPage } = await import("../src/app/groups/[groupId]/expenses/new/page.tsx");
const { default: GuestPage } = await import("../src/app/g/[shareToken]/expenses/new/page.tsx");
const { default: ExpenseForm } = await import("../src/components/expenses/expense-form.tsx");
const { default: ExpenseReview } = await import("../src/components/expenses/expense-review.tsx");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
hooks.deregister();
beforeEach(reset);
const ownerProps = (groupId = "1") => ({ params: Promise.resolve({ groupId }) });
const guestProps = (shareToken = token) => ({ params: Promise.resolve({ shareToken }) });
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
function owner() {
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true });
}
async function guest() { await setGuestSessionCookie(await claimMember(token, 2)); }
for (const kind of ["owner", "guest"]) test(`${kind} page uses shared form with safe options and current-member default`, async () => {
  if (kind === "owner") owner(); else await guest();
  state.rows.GroupMember.push(
    { ...state.rows.GroupMember[0], id: 20, name: "Waiting", claimedAt: null },
    { ...state.rows.GroupMember[0], id: 21, name: "Inactive", isActive: false },
    { ...state.rows.GroupMember[0], id: 22, name: "Foreign", groupId: 99 },
  );
  const page = await (kind === "owner" ? OwnerPage(ownerProps()) : GuestPage(guestProps()));
  const formNode = nodes(page).find(node => node.type === ExpenseForm);
  assert.ok(formNode);
  assert.doesNotMatch(JSON.stringify(formNode.props), /shareToken|tokenHash|expiresAt|userId|Inactive|Foreign/);
  const form = ExpenseForm(formNode.props);
  const fields = nodes(form);
  for (const name of ["description", "amount", "paidByMemberId", "participantIds"]) assert.ok(fields.some(node => node.props.name === name), name);
  for (const id of ["expense-description", "expense-amount", "expense-payer"]) {
    assert.ok(fields.some(node => node.type === "label" && node.props.htmlFor === id));
    assert.ok(fields.some(node => node.props.id === id));
  }
  assert.match(text(form), /Amount \(GBP\)/);
  assert.equal(fields.find(node => node.type === "select").props.defaultValue, kind === "owner" ? "10" : "2");
  const expectedIds = kind === "owner" ? [2, 10, 20] : [2, 20];
  assert.deepEqual(fields.filter(node => node.type === "option").map(node => node.props.value), expectedIds);
  const checkboxes = fields.filter(node => node.props.type === "checkbox");
  assert.deepEqual(checkboxes.map(node => node.props.value), expectedIds);
  assert.ok(checkboxes.every(node => node.props.name === "participantIds" && !node.props.disabled));
  assert.deepEqual(fields.filter(node => node.type === "option").map(text), kind === "owner" ? ["Jaher", "Owner", "Waiting"] : ["Jaher", "Waiting"]);
  assert.match(text(form), /adjust each share/);
  assert.equal(fields.find(node => node.type === "button").props.value, "review");
  assert.equal(typeof form.props.action, "function");
  assert.equal(typeof formNode.props.action, "function");
});
test("unauthenticated owner is redirected to login", async () => {
  await assert.rejects(OwnerPage(ownerProps()), { destination: "/login?next=/dashboard" });
});
test("owner route rejects malformed and inaccessible groups", async () => {
  owner();
  for (const id of ["0", "01", "1.5", "2147483648", "bad", "99"]) await assert.rejects(OwnerPage(ownerProps(id)), { status: 404 });
  state.rows.Group[0].createdBy = 99;
  await assert.rejects(OwnerPage(ownerProps()), { status: 404 });
});
test("guest URL requires a guest cookie even when owner is signed in", async () => {
  owner();
  await assert.rejects(GuestPage(guestProps()), { destination: `/g/${token}` });
  await assert.rejects(GuestPage(guestProps("//evil.example")), { destination: "/g/invalid" });
});
test("cross-group and expired guest sessions redirect before showing a form", async () => {
  await guest();
  const otherToken = Buffer.alloc(32, 3).toString("base64url");
  state.rows.Group.push({ id: 99, name: "Foreign", shareToken: otherToken, currency: "GBP" });
  await assert.rejects(GuestPage(guestProps(otherToken)), { destination: `/g/${otherToken}` });
  state.rows.GuestSession[0].expiresAt = "2000-01-01";
  await assert.rejects(GuestPage(guestProps()), { destination: `/g/${token}` });
});
for (const kind of ["owner", "guest"]) test(`${kind} database failures show a safe message without form data`, async () => {
  if (kind === "owner") owner(); else await guest();
  state.failAt = "GroupMember.all";
  const tree = await (kind === "owner" ? OwnerPage(ownerProps()) : GuestPage(guestProps()));
  assert.match(text(tree), /Expense form temporarily unavailable/);
  assert.doesNotMatch(text(tree), /PRIVATE_DATABASE_DETAILS|Football|Jaher/);
  assert.ok(!nodes(tree).some(node => node.type === ExpenseForm));
});

const context = {
  group: { name: "Football", currency: "GBP" }, currentMember: { id: 10, name: "Owner" },
  members: [{ id: 2, name: "Jaher" }, { id: 10, name: "Owner" }, { id: 20, name: "Waiting" }],
};
const draft = { description: "Court", amount: "10.00", paidByMemberId: "2", participantIds: ["2", "10", "20"] };
const action = async () => ({});
test("confirmation shows server-provided description, total, payer and every share", () => {
  state.actionState = { input: draft, review: {
    description: "Court", amount: "10.00", payer: { id: 2, name: "Jaher" },
    participants: [{ id: 2, name: "Jaher", amount: "3.34" }, { id: 10, name: "Owner", amount: "3.33" }, { id: 20, name: "Waiting", amount: "3.33" }],
  } };
  const reviewNode = ExpenseForm({ context, action });
  assert.equal(reviewNode.type, ExpenseReview);
  const tree = ExpenseReview(reviewNode.props);
  const content = text(tree);
  for (const expected of ["Review expense", "Court", "£10.00", "Jaher", "Owner", "Waiting", "Back and edit", "Confirm & Save"]) assert.ok(content.includes(expected), expected);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareAmount").map(node => node.props.value), ["3.34", "3.33", "3.33"]);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "intent").map(node => node.props.value), ["edit", "save"]);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "participantIds").map(node => node.props.value), draft.participantIds);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareMemberId").map(node => node.props.value), [2, 10, 20]);
  state.pending = true;
  assert.ok(nodes(ExpenseReview(ExpenseForm({ context, action }).props)).filter(node => node.type === "button").every(node => node.props.disabled));
});
test("back/edit and validation failures restore all input values and participant selections", () => {
  state.actionState = { input: draft, error: "Choose active members." };
  const tree = ExpenseForm({ context, action });
  const fields = nodes(tree);
  assert.equal(fields.find(node => node.props.name === "description").props.defaultValue, "Court");
  assert.equal(fields.find(node => node.props.name === "amount").props.defaultValue, "10.00");
  assert.equal(fields.find(node => node.type === "select").props.defaultValue, "2");
  assert.ok(fields.filter(node => node.props.type === "checkbox").every(node => node.props.defaultChecked));
  assert.equal(text(fields.find(node => node.props.role === "alert")), "Choose active members.");
  assert.ok(!text(tree).includes("Confirm and save"));
});
test("pending review disables inputs and gives progress feedback", () => {
  state.pending = true;
  const tree = ExpenseForm({ context, action });
  assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, true);
  assert.equal(nodes(tree).find(node => node.type === "button").props.disabled, true);
  assert.match(text(nodes(tree).find(node => node.props.role === "status")), /Calculating/);
});

for (const kind of ["owner", "guest"]) test(`${kind} new expense page supplies a fresh UUID`, async () => {
  if (kind === "owner") owner(); else await guest();
  const page = () => kind === "owner" ? OwnerPage(ownerProps()) : GuestPage(guestProps());
  const first = nodes(await page()).find(node => node.type === ExpenseForm).props.requestKey;
  const second = nodes(await page()).find(node => node.type === ExpenseForm).props.requestKey;
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, second);
});
test("creation key survives rerender, review, back/edit, validation and replacement server props", async () => {
  const { renderWithState } = await import("./helpers/guest-environment.mjs");
  const key = "11111111-1111-4111-8111-111111111111";
  const props = { context, action, requestKey: key };
  const keyIn = tree => nodes(tree).find(node => node.props.name === "requestKey").props.value;
  assert.equal(keyIn(renderWithState(ExpenseForm, props)), key);
  state.actionState = { input: draft, review: { description: draft.description, amount: draft.amount, payer: context.members[0], participants: [{ ...context.members[0], amount: "10.00" }] } };
  const review = renderWithState(ExpenseForm, { ...props, requestKey: "22222222-2222-4222-8222-222222222222" });
  assert.equal(keyIn(ExpenseReview(review.props)), key);
  state.actionState = { input: draft, error: "Try again" };
  assert.equal(keyIn(renderWithState(ExpenseForm, props)), key);
});
test("saved expense forms and reviews contain no creation key", () => {
  assert.ok(!nodes(ExpenseForm({ context, action, editing: true, requestKey: "ignored" })).some(node => node.props.name === "requestKey"));
  const tree = ExpenseReview({ input: draft, review: { description: draft.description, amount: draft.amount, payer: context.members[0], participants: [{ ...context.members[0], amount: "10.00" }] }, action, editing: true, requestKey: "ignored" });
  assert.ok(!nodes(tree).some(node => node.props.name === "requestKey"));
});
test("lost action response retains raw fields, custom shares, review and creation key", async () => {
  const key = "11111111-1111-4111-8111-111111111111";
  ExpenseForm({ context, requestKey: key, action: async () => { throw new Error("Network failure"); } });
  const data = new FormData();
  for (const [name, value] of Object.entries({ description: "Dinner", amount: "10", paidByMemberId: "2", requestKey: key })) data.set(name, value);
  data.append("participantIds", "2"); data.append("shareMemberId", "2"); data.append("shareAmount", "10");
  const review = { description: "Dinner", amount: "10.00", payer: context.members[0], participants: [{ ...context.members[0], amount: "10.00" }] };
  const result = await state.actions.at(-1)({ review }, data);
  assert.equal(result.requestKey, key); assert.equal(result.review, review);
  assert.equal(result.input.description, "Dinner"); assert.deepEqual(result.input.shares, [{ memberId: "2", amount: "10" }]);
  assert.match(result.error, /Retry here with the same details/);
});
test("framework redirects pass through the response recovery handler", async () => {
  ExpenseForm({ context, action: async () => { throw Object.assign(new Error("redirect"), { destination: "/groups/1" }); } });
  await assert.rejects(state.actions.at(-1)({}, new FormData()), { destination: "/groups/1" });
});
test("committed refresh failure offers navigation without another save button", () => {
  state.actionState = { savedDestination: "/groups/1", requestKey: "same-key" };
  const tree = ExpenseForm({ context, action });
  assert.match(text(tree), /expense was saved/);
  assert.ok(nodes(tree).some(node => node.props.href === "/groups/1"));
  assert.ok(!nodes(tree).some(node => node.type === "form" || node.type === "button"));
});
