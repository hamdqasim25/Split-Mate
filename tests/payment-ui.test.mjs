import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { beforeEach, test } from "node:test";
import { installHooks, renderWithState, reset, state, token } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { guestPaymentAction, ownerPaymentAction, reviewPaymentAction } = await import("../src/app/actions/payments.ts");
const { claimMember } = await import("../src/data/invites.ts");
const { setGuestSessionCookie } = await import("../src/lib/auth/guest-session.ts");
const { default: PaymentPanel, PaymentForm, PaymentReview } = await import("../src/components/groups/payment-panel.tsx");
const { default: BalanceList } = await import("../src/components/groups/balance-list.tsx");
const { default: OwnerPage } = await import("../src/app/groups/[groupId]/page.tsx");
const { default: GuestPage } = await import("../src/app/g/[shareToken]/group/page.tsx");
hooks.deregister();
beforeEach(async () => {
  reset();
  state.rows.Group[0].createdAt = "2026-01-01";
  state.rows.User.push({ id: 7, name: "Owner" });
  state.rows.UserSession.push({ userId: 7, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString() });
  state.cookies.set("splitmate_owner_session", token);
  state.rows.GroupMember.push({ id: 10, groupId: 1, userId: 7, name: "Owner", role: "OWNER", isActive: true });
  await setGuestSessionCookie(await claimMember(token, 2));
  state.rows.Expense.push({ id: 1, groupId: 1, paidByMemberId: 10, amount: "10.01", description: "Lunch", createdAt: "2026-01-01", splitMethod: "EQUAL" });
  state.rows.ExpenseParticipant.push({ expenseId: 1, memberId: 2, amountOwed: "10.01" });
});
function form(owner = false) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ requestKey: randomUUID(), receiverMemberId: "10", amount: "5.00", ...(owner ? { payerMemberId: "2" } : {}) })) data.set(key, value);
  return data;
}
function decision(value) { const data = new FormData(); data.set("decision", value); return data; }
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== "object") return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const history = (status = "SENT", receiverMemberId = 10) => ({ id: 1, payerMemberId: 2, receiverMemberId, payerName: "Guest", receiverName: "Owner", amount: "5.00", status, createdAt: "2026-10-18T12:00:00.000Z" });
const props = owner => ({ access: owner ? { kind: "owner", groupId: 1 } : { kind: "guest", shareToken: token }, members: [{ id: 2, name: "Guest" }, { id: 10, name: "Owner" }], currentMemberId: owner ? 10 : 2, requestKey: randomUUID() });

test("guest report action refreshes both views, pending leaves balances unchanged, owner confirmation refreshes again", async () => {
  const reported = await guestPaymentAction(token, {}, form());
  assert.match(reported.success, /Awaiting owner confirmation/);
  assert.deepEqual(state.revalidated, ["/dashboard", "/groups/1", `/g/${token}/group`]);
  const reviewed = await reviewPaymentAction(1, 1, {}, decision("confirm"));
  assert.ok(reviewed.success);
  assert.equal(state.rows.Payment[0].status, "CONFIRMED");
  assert.equal(state.revalidated.length, 6);
});

test("direct action records confirmed external payment and idempotent retry succeeds", async () => {
  const data = form(true);
  assert.match((await ownerPaymentAction(1, {}, data)).success, /balances updated/);
  assert.match((await ownerPaymentAction(1, {}, data)).success, /already recorded/);
  assert.equal(state.rows.Payment.length, 1);
  assert.equal(state.revalidated.filter(path => path === "/dashboard").length, 2);
});

test("action rejection is visible and repeated review does not duplicate activity", async () => {
  await guestPaymentAction(token, {}, form());
  assert.ok((await reviewPaymentAction(1, 1, {}, decision("reject"))).success);
  assert.match((await reviewPaymentAction(1, 1, {}, decision("reject"))).success, /already reviewed/);
  assert.equal(state.rows.Payment[0].status, "REJECTED");
  assert.equal(state.rows.ActivityEvent.filter(event => event.eventType === "PAYMENT_REJECTED").length, 1);
});

test("actions reject impersonation, duplicate fields, file fields and unauthorized reviews", async () => {
  assert.match((await guestPaymentAction(token, {}, form(true))).error, /only report your own/);
  const duplicate = form(); duplicate.append("amount", "1");
  assert.ok((await guestPaymentAction(token, {}, duplicate)).error);
  const file = form(); file.set("amount", new Blob(["1"]), "amount.txt");
  assert.ok((await guestPaymentAction(token, {}, file)).error);
  state.cookies.delete("splitmate_owner_session");
  assert.ok((await reviewPaymentAction(1, 1, {}, decision("confirm"))).error);
  assert.equal(state.rows.Payment.length, 0);
});

test("unexpected failure rolls back, gives safe error and permits retry with same key", async () => {
  const data = form(); state.failAt = "ActivityEvent.create";
  const failed = await guestPaymentAction(token, {}, data);
  assert.match(failed.error, /Retry this same form/);
  assert.doesNotMatch(JSON.stringify(failed), /PRIVATE_DATABASE_DETAILS/);
  assert.equal(state.rows.Payment.length, 0);
  assert.deepEqual(state.revalidated, []);
  state.failAt = null;
  assert.ok((await guestPaymentAction(token, {}, data)).success);
});

for (const owner of [true, false]) test(`${owner ? "owner" : "guest"} page includes payment panel with authorized identity and updated balance`, async () => {
  await ownerPaymentAction(1, {}, form(true));
  const tree = await (owner ? OwnerPage({ params: Promise.resolve({ groupId: "1" }) }) : GuestPage({ params: Promise.resolve({ shareToken: token }) }));
  const panel = nodes(tree).find(node => node.type === PaymentPanel);
  assert.ok(panel);
  assert.equal(panel.props.currentMemberId, owner ? 10 : 2);
  assert.equal(panel.props.access.kind, owner ? "owner" : "guest");
  assert.equal(panel.props.payments[0].status, "CONFIRMED");
  const balances = nodes(tree).find(node => node.type === BalanceList).props.balances;
  assert.equal(balances.members.find(row => row.id === 2).net, "-5.01");
  assert.match(text(BalanceList({ balances })), /Confirmed sent.*5.00/);
});

test("guest has no sender selector or confirmation controls; labels explain external reporting", () => {
  const view = PaymentForm(props(false));
  assert.equal(nodes(view).filter(node => node.props?.name === "payerMemberId").length, 0);
  assert.match(text(view), /I've paid.*outside SPLITMate.*owner must confirm/s);
  const panel = PaymentPanel({ ...props(false), payments: [history()], available: true });
  assert.equal(nodes(panel).filter(node => node.type === PaymentReview).length, 0);
  assert.match(text(panel), /Awaiting confirmation.*Not yet applied/);
});

test("owner controls distinguish receipt from verification with another recipient", () => {
  assert.match(text(PaymentReview({ groupId: 1, payment: history(), currentMemberId: 10 })), /Confirm receipt/);
  const other = text(PaymentReview({ groupId: 1, payment: history("SENT", 3), currentMemberId: 10 }));
  assert.match(other, /Verify with the recipient.*Confirm payment.*Reject report/);
  assert.match(text(PaymentForm(props(true))), /completed payment.*external payment.*matching report/s);
});

test("history includes all text statuses and accessible empty/unavailable states", () => {
  const panel = PaymentPanel({ ...props(true), payments: [history(), { ...history("CONFIRMED"), id: 2 }, { ...history("REJECTED"), id: 3 }], available: true });
  for (const label of ["Awaiting confirmation", "Confirmed", "Rejected", "does not transfer money"]) assert.ok(text(panel).includes(label));
  assert.equal(nodes(panel).filter(node => node.type === PaymentReview).length, 1);
  const unavailable = PaymentPanel({ ...props(false), payments: [], available: false });
  assert.match(text(unavailable), /New payments are unavailable.*No repayments/s);
  assert.equal(nodes(unavailable).filter(node => node.type === PaymentForm).length, 0);
});

test("pending disables form and review fieldsets, errors and success use live roles", () => {
  state.pending = true; state.actionState = { error: "Try again", success: "Saved" };
  for (const tree of [PaymentForm(props(true)), PaymentReview({ groupId: 1, payment: history(), currentMemberId: 10 })]) {
    assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, true);
    const result = nodes(tree).find(node => typeof node.type === "function" && node.type.name === "Result");
    const rendered = result.type(result.props);
    assert.ok(nodes(rendered).some(node => node.props?.role === "alert"));
    assert.ok(nodes(rendered).some(node => node.props?.role === "status"));
  }
});

test("form retains key and values on failure and rotates key plus refreshes only on success", async () => {
  const formProps = props(false);
  let tree = renderWithState(PaymentForm, formProps);
  nodes(tree).find(node => node.props?.name === "amount").props.onChange({ target: { value: "5.00" } });
  tree = renderWithState(PaymentForm, formProps);
  const data = form(); data.set("requestKey", formProps.requestKey);
  state.failAt = "Payment.create";
  const failed = await state.actions.at(-1)({}, data);
  assert.ok(failed.error);
  tree = renderWithState(PaymentForm, formProps);
  assert.equal(nodes(tree).find(node => node.props?.name === "requestKey").props.value, formProps.requestKey);
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "5.00");
  assert.equal(state.refreshes, 0);
  state.failAt = null;
  assert.ok((await state.actions.at(-1)({}, data)).success);
  tree = renderWithState(PaymentForm, formProps);
  assert.notEqual(nodes(tree).find(node => node.props?.name === "requestKey").props.value, formProps.requestKey);
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "");
  assert.equal(state.refreshes, 1);
});
