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
const { default: AllocationFields } = await import("../src/components/groups/payment-allocation-fields.tsx");
const { default: OwnerPage } = await import("../src/app/groups/[groupId]/page.tsx");
const { default: GuestPage } = await import("../src/app/g/[shareToken]/group/page.tsx");
const { getLedgerForGroup } = await import("../src/data/balances.ts");
const { paymentOptions, canConfirmPayment } = await import("../src/lib/payments/eligibility.ts");
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
  data.set("allocationExpenseId", "1"); data.set("allocationAmount", "5.00");
  return data;
}
async function decision(value) { const data = new FormData(); data.set("decision", value); data.set("allocationVersion", (await getLedgerForGroup(1)).payments[0]?.allocationVersion ?? "missing"); return data; }
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
const history = (status = "SENT", receiverMemberId = 10) => ({ id: 1, payerMemberId: 2, receiverMemberId, payerName: "Guest", receiverName: "Owner", amount: "5.00", allocations: [{ expenseId: 1, amountPence: "500", valid: true, excluded: false }], status, createdAt: "2026-10-18T12:00:00.000Z" });
const props = owner => ({ access: owner ? { kind: "owner", groupId: 1 } : { kind: "guest", shareToken: token }, recipients: [{ id: 10, name: "Owner", maximum: "10.01" }], senderId: 2, requestKey: randomUUID() });

for (const entered of ["5", "5.0", "5.00"]) test(`football payment allocation ${entered} commits once and renders safely after success/reset`, async () => {
  state.rows.GroupMember.find(row => row.id === 10).name = "Hamdi Qasim";
  state.rows.Expense[0].description = "football 24th oct";
  const options = { ...props(true), recipients: [{ id: 10, name: "Hamdi Qasim", maximum: "5.00" }],
    expenses: (await getLedgerForGroup(1)).paymentExpenses };
  let tree = renderWithState(PaymentForm, options);
  const child = nodes(tree).find(node => node.type === AllocationFields);
  const preview = AllocationFields({ ...child.props, initial: { 1: entered } });
  assert.match(text(preview), /Assigned £5.00.*Remaining £0.00/);
  const data = form(true); data.set("requestKey", options.requestKey); data.set("amount", entered); data.set("allocationAmount", entered);
  const result = await state.actions.at(-1)({}, data);
  assert.ok(result.success);
  // Verify the transaction has committed BEFORE rendering the reset child.
  assert.equal(state.rows.Payment.length, 1);
  assert.equal(state.rows.Payment[0].status, "CONFIRMED");
  assert.equal(state.rows.Payment[0].amount, "5.00");
  assert.equal(state.rows.PaymentAllocation[0].amountPence, 500n);
  tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.type === "form").props.hidden, true);
  const resetChild = nodes(tree).find(node => node.type === AllocationFields);
  assert.equal(resetChild.props.amount, "", "the actual reset value passed to the money renderer");
  assert.notEqual(resetChild.key, child.key, "allocations remount only after acknowledged success");
  assert.doesNotThrow(() => AllocationFields(resetChild.props));
  assert.match((await ownerPaymentAction(1, {}, data)).success, /already recorded/);
  assert.equal(state.rows.Payment.length, 1);
  assert.equal(state.rows.ActivityEvent.filter(row => row.eventType === "PAYMENT_RECORDED").length, 1);
});

test("clearing and editing the payment total or recipient keeps rendering safe without writes", () => {
  const options = props(true);
  let tree = renderWithState(PaymentForm, options);
  for (const value of ["", ".", "5.", "5.0", "5.00", "bad", "5.001", "£5", "1,000", "-5", "0", "5"]) {
    nodes(tree).find(node => node.props.name === "amount").props.onChange({ target: { value } });
    tree = renderWithState(PaymentForm, options);
    const child = nodes(tree).find(node => node.type === AllocationFields);
    const preview = AllocationFields({ ...child.props, initial: { 1: "5" } });
    assert.equal(child.props.amount, value, "draft must not be normalized or replaced");
    if (["5", "5.0", "5.00"].includes(value)) assert.match(text(preview), /Remaining £0.00/);
    else assert.match(text(preview), /Remaining unavailable.*payment amount|Remaining unavailable.*Payment amount/);
  }
  nodes(tree).find(node => node.props.name === "receiverMemberId").props.onChange({ target: { value: "" } });
  tree = renderWithState(PaymentForm, options);
  assert.doesNotThrow(() => AllocationFields(nodes(tree).find(node => node.type === AllocationFields).props));
  assert.equal(state.rows.Payment.length, 0);
});

test("allocation edits retain raw invalid input, flag its field and omit unused blanks", () => {
  const options = { amount: "5.00", prefix: "draft", expenses: [{ id: 1, description: "football 24th oct" }, { id: 2, description: "Unused" }] };
  let tree = renderWithState(AllocationFields, options);
  for (const value of ["5", "", ".", "5.", "5.0", "bad", "5.001", "£5", "1,000", "-5", "0", " ", "5.00"]) {
    nodes(tree).find(node => node.props.id === "draft-1").props.onChange({ target: { value } });
    tree = renderWithState(AllocationFields, options);
    const input = nodes(tree).find(node => node.props.id === "draft-1");
    assert.equal(input.props.value, value);
    if (["5", "5.0", "5.00"].includes(value)) {
      assert.equal(input.props["aria-invalid"], false); assert.match(text(tree), /Assigned £5.00.*Remaining £0.00/);
    } else if (value === "") {
      assert.equal(input.props.name, undefined); assert.equal(input.props["aria-invalid"], false);
      assert.match(text(tree), /Assigned £0.00.*Remaining £5.00/);
    } else {
      assert.equal(input.props.name, "allocationAmount", "invalid values still reach strict server validation");
      assert.equal(input.props["aria-invalid"], true);
      assert.equal(input.props["aria-describedby"], "draft-1-error");
      assert.ok(nodes(tree).find(node => node.props.id === "draft-1-error"));
      assert.match(text(tree), /Assigned unavailable.*Remaining unavailable/);
    }
    assert.equal(nodes(tree).find(node => node.props.id === "draft-2").props.name, undefined);
  }
});

test("blank unused allocation fields submit no zero allocation and preserve exact pennies", async () => {
  const options = { amount: "5.00", prefix: "unused", expenses: [{ id: 1, description: "football 24th oct" }, { id: 2, description: "Unused" }], initial: { 1: "5", 2: "" } };
  const tree = AllocationFields(options);
  const data = form(true); data.delete("allocationExpenseId"); data.delete("allocationAmount");
  for (const node of nodes(tree)) if (node.type === "input" && node.props.name) data.append(node.props.name, String(node.props.value));
  assert.deepEqual(data.getAll("allocationExpenseId"), ["1"]);
  assert.deepEqual(data.getAll("allocationAmount"), ["5"]);
  // The action also tolerates explicitly paired blank unused fields.
  data.append("allocationExpenseId", "2"); data.append("allocationAmount", "");
  assert.ok((await ownerPaymentAction(1, {}, data)).success);
  assert.equal(state.rows.PaymentAllocation.length, 1);
  assert.equal(state.rows.PaymentAllocation[0].amountPence, 500n);
  assert.equal(state.rows.PaymentAllocation[0].expenseId, 1);
});

for (const field of ["amount", "allocationAmount"]) for (const value of ["", " ", ".", "5.", "5.001", "£5", "-5", "0"]) test(`server rejects ${field} ${JSON.stringify(value)} without recording or coercing`, async () => {
  const data = form(true); data.set(field, value);
  const result = await ownerPaymentAction(1, {}, data);
  assert.ok(result.error); assert.equal(state.rows.Payment.length, 0); assert.equal(state.rows.PaymentAllocation.length, 0);
});

test("valid but under/over-allocated drafts keep exact totals and server refuses submission", async () => {
  for (const value of ["4.99", "5.01"]) {
    const preview = AllocationFields({ expenses: [{ id: 1, description: "Football" }], amount: "5.00", initial: { 1: value }, prefix: "mismatch" });
    assert.match(text(preview), value === "4.99" ? /Remaining £0.01/ : /Remaining £-0.01/);
    const data = form(true); data.set("allocationAmount", value);
    assert.match((await ownerPaymentAction(1, {}, data)).error, /exactly/);
  }
  assert.equal(state.rows.Payment.length, 0);
});

test("post-commit refresh failure retains the same request and retry records no second payment", async () => {
  const options = props(true); let tree = renderWithState(PaymentForm, options);
  nodes(tree).find(node => node.props.name === "amount").props.onChange({ target: { value: "5.00" } });
  tree = renderWithState(PaymentForm, options);
  const data = form(true); data.set("requestKey", options.requestKey); data.set("allocationAmount", "5");
  const original = console.error; console.error = () => {};
  state.revalidated = { push() { throw new Error("Simulated refresh failure after commit"); } };
  try { assert.ok((await state.actions.at(-1)({}, data)).error); }
  finally { console.error = original; state.revalidated = []; }
  assert.equal(state.rows.Payment.length, 1, "response error does not undo a committed payment");
  tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.props.name === "requestKey").props.value, options.requestKey);
  assert.equal(nodes(tree).find(node => node.props.name === "amount").props.value, "5.00");
  assert.match((await state.actions.at(-1)({}, data)).success, /already recorded/);
  tree = renderWithState(PaymentForm, options);
  assert.doesNotThrow(() => AllocationFields(nodes(tree).find(node => node.type === AllocationFields).props));
  assert.equal(state.rows.Payment.length, 1); assert.equal(state.rows.PaymentAllocation.length, 1);
});

test("guest report action refreshes both views, pending leaves balances unchanged, owner confirmation refreshes again", async () => {
  const reported = await guestPaymentAction(token, {}, form());
  assert.match(reported.success, /Awaiting owner confirmation/);
  assert.deepEqual(state.revalidated, ["/dashboard", "/groups/1", `/g/${token}/group`]);
  const reviewed = await reviewPaymentAction(1, 1, {}, await decision("confirm"));
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
  assert.ok((await reviewPaymentAction(1, 1, {}, await decision("reject"))).success);
  assert.match((await reviewPaymentAction(1, 1, {}, await decision("reject"))).success, /already reviewed/);
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
  assert.ok((await reviewPaymentAction(1, 1, {}, await decision("confirm"))).error);
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
  const cardProps = nodes(tree).find(node => node.type === BalanceList).props;
  assert.equal(cardProps.currentMemberId, owner ? 10 : 2);
  assert.equal(cardProps.access.kind, owner ? "owner" : "guest");
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
  assert.match(text(panel), /Awaiting confirmation.*not yet applied/);
});

test("owner controls distinguish receipt from verification with another recipient", () => {
  assert.match(text(PaymentReview({ groupId: 1, payment: history(), currentMemberId: 10 })), /Confirm receipt/);
  const other = text(PaymentReview({ groupId: 1, payment: history("SENT", 3), currentMemberId: 10 }));
  assert.match(other, /Verify with the recipient.*Confirm payment.*Reject/);
  assert.match(text(PaymentForm(props(true))), /Record payment.*external payment already completed.*matching report/s);
});

test("history includes all text statuses and accessible empty/unavailable states", () => {
  const panel = PaymentPanel({ ...props(true), payments: [history(), { ...history("CONFIRMED"), id: 2 }, { ...history("REJECTED"), id: 3 }], available: true });
  for (const label of ["Awaiting confirmation", "Confirmed", "Rejected", "does not transfer money"]) assert.ok(text(panel).includes(label));
  assert.equal(nodes(panel).filter(node => node.type === PaymentReview).length, 0);
  const unavailable = PaymentPanel({ ...props(false), payments: [], available: false });
  assert.match(text(unavailable), /No repayments/);
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

test("guest actions are restricted to their own card; owner actions fix each eligible sender", async () => {
  const ledger = await getLedgerForGroup(1);
  for (const owner of [false, true]) {
    const access = owner ? { kind: "owner", groupId: 1 } : { kind: "guest", shareToken: token };
    const tree = BalanceList({ ...ledger, access, currentMemberId: owner ? 10 : 2 });
    const forms = nodes(tree).filter(node => node.type === PaymentForm && node.props.recipients.length);
    assert.equal(forms.length, 1);
    assert.equal(forms[0].props.senderId, 2);
    const formTree = PaymentForm(forms[0].props);
    const sender = nodes(formTree).find(node => node.props?.name === "payerMemberId");
    assert.equal(sender?.props.value, owner ? 2 : undefined);
    assert.equal(sender?.props.type, owner ? "hidden" : undefined);
    assert.equal(nodes(tree).filter(node => node.type === "details").length, 2);
    assert.equal(nodes(tree).filter(node => node.type === "summary").length, 2);
    assert.match(text(tree), /You/);
    assert.match(text(tree), /View breakdown/);
    assert.deepEqual(nodes(tree).filter(node => node.type === "h3").map(node => text(node).replace("You", "")), ["Jaher", "Owner"]);
  }
  const otherGuest = BalanceList({ ...ledger, access: { kind: "guest", shareToken: token }, currentMemberId: 10 });
  assert.equal(nodes(otherGuest).filter(node => node.type === PaymentForm && node.props.recipients.length).length, 0);
});

test("full pending reservation explains waiting and places owner review only in sender card", async () => {
  const data = form(); data.set("amount", "10.01"); data.set("allocationAmount", "10.01");
  await guestPaymentAction(token, {}, data);
  const ledger = await getLedgerForGroup(1);
  const guest = BalanceList({ ...ledger, access: { kind: "guest", shareToken: token }, currentMemberId: 2 });
  assert.match(text(guest), /10.01 awaiting confirmation/);
  assert.equal(nodes(guest).filter(node => node.type === PaymentForm && node.props.recipients.length).length, 0);
  assert.equal(nodes(guest).filter(node => node.type === PaymentReview).length, 0);
  const owner = BalanceList({ ...ledger, access: { kind: "owner", groupId: 1 }, currentMemberId: 10 });
  const reviews = nodes(owner).filter(node => node.type === PaymentReview);
  assert.equal(reviews.length, 1); assert.equal(reviews[0].props.canConfirm, true);
  assert.match(text(PaymentReview(reviews[0].props)), /Confirm receipt/);
  assert.equal(nodes(PaymentPanel({ payments: ledger.payments })).filter(node => node.type === PaymentReview || node.type === PaymentForm).length, 0);
});

test("eligibility shares exact outgoing/incoming reservations with validation and supports other recipients", async () => {
  const ledger = await getLedgerForGroup(1);
  ledger.balances.members.push({ ...ledger.balances.members[1], id: 30, name: "Other creditor", net: "3.00" });
  ledger.balances.members.find(member => member.id === 10).net = "7.01";
  const pending = { ...history(), amount: "2.01", allocations: [{ expenseId: 1, amountPence: "201", valid: true, excluded: false }] };
  const options = paymentOptions(ledger.balances, [pending], 2);
  assert.deepEqual(options.map(row => [row.id, row.maximum]), [[10, "5.00"], [30, "3.00"]]);
  assert.equal(canConfirmPayment(ledger.balances, [pending], pending), true);
  ledger.balances.members.find(member => member.id === 10).isActive = false;
  assert.equal(canConfirmPayment(ledger.balances, [pending], pending), false);
  assert.deepEqual(paymentOptions(ledger.balances, [pending], 2).map(row => row.id), [30]);
  assert.deepEqual(paymentOptions({ status: "unavailable" }, [], 2), []);
});

test("single recipient defaults to exact maximum; multiple recipients require selection and permit partial amounts", () => {
  const single = PaymentForm(props(false));
  assert.equal(nodes(single).find(node => node.props?.name === "receiverMemberId").props.value, "10");
  assert.equal(nodes(single).find(node => node.props?.name === "amount").props.value, "10.01");
  const options = { ...props(true), recipients: [{ id: 10, name: "Owner", maximum: "5.00" }, { id: 30, name: "Other", maximum: "3.01" }] };
  let tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.props?.name === "receiverMemberId").props.value, "");
  nodes(tree).find(node => node.props?.name === "receiverMemberId").props.onChange({ target: { value: "30" } });
  tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "3.01");
  nodes(tree).find(node => node.props?.name === "amount").props.onChange({ target: { value: "0.01" } });
  tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "0.01");
});

test("open and cancel preserve intent, move focus and never nest forms", t => {
  const previousAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => callback();
  t.after(() => { if (previousAnimationFrame) globalThis.requestAnimationFrame = previousAnimationFrame; else delete globalThis.requestAnimationFrame; });
  const options = props(false);
  let tree = renderWithState(PaymentForm, options);
  let triggerFocus = 0, recipientFocus = 0;
  const trigger = nodes(tree).find(node => node.props?.["aria-controls"]);
  trigger.props.ref.current = { focus() { triggerFocus++; } };
  nodes(tree).find(node => node.type === "select").props.ref.current = { focus() { recipientFocus++; } };
  trigger.props.onClick(); tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.type === "form").props.hidden, false);
  assert.equal(recipientFocus, 1);
  nodes(tree).find(node => node.type === "button" && text(node) === "Cancel").props.onClick();
  tree = renderWithState(PaymentForm, options);
  assert.equal(nodes(tree).find(node => node.type === "form").props.hidden, true);
  assert.equal(triggerFocus, 1);
  assert.equal(nodes(tree).filter(node => node.type === "form").length, 1);
  assert.equal(nodes(tree).find(node => node.props?.name === "requestKey").props.value, options.requestKey);
});

test("rapid repeated submit is blocked before React pending state updates", async () => {
  renderWithState(PaymentForm, props(false));
  const action = state.actions.at(-1);
  const first = action({}, form());
  const second = await action({}, form());
  assert.deepEqual(second, {});
  assert.ok((await first).success);
  assert.equal(state.rows.Payment.length, 1);
});

test("stale or inactive reports permit rejection but hide confirmation", () => {
  const tree = PaymentReview({ groupId: 1, payment: history(), currentMemberId: 10, canConfirm: false });
  assert.equal(nodes(tree).filter(node => node.props?.value === "confirm").length, 0);
  assert.equal(nodes(tree).filter(node => node.props?.value === "reject").length, 1);
});

test("uncertain submission retains its open retry form when refreshed eligibility is exhausted", async t => {
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => callback();
  t.after(() => { if (previous) globalThis.requestAnimationFrame = previous; else delete globalThis.requestAnimationFrame; });
  const options = props(false);
  let tree = renderWithState(PaymentForm, options);
  nodes(tree).find(node => node.props?.["aria-controls"]).props.onClick();
  tree = renderWithState(PaymentForm, options);
  state.failAt = "Payment.create";
  const data = form(); data.set("requestKey", options.requestKey);
  assert.ok((await state.actions.at(-1)({}, data)).error);
  tree = renderWithState(PaymentForm, { ...options, recipients: [], requestKey: randomUUID() });
  assert.equal(nodes(tree).find(node => node.type === "form").props.hidden, false);
  assert.equal(nodes(tree).find(node => node.props?.name === "requestKey").props.value, options.requestKey);
  assert.equal(nodes(tree).find(node => node.props?.name === "receiverMemberId").props.value, "10");
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "10.01");
  assert.match(text(tree), /Previously selected recipient/);
});

test("server options cap enormous exact balances to the existing per-payment limit", async () => {
  const ledger = await getLedgerForGroup(1);
  ledger.balances.members.find(member => member.id === 2).net = "-900719925474099.99";
  ledger.balances.members.find(member => member.id === 10).net = "900719925474099.99";
  assert.equal(paymentOptions(ledger.balances, [], 2)[0].maximum, "999999999.99");
});

test("compact rows align name and amount, with pending review and breakdown collapsed", async () => {
  await guestPaymentAction(token, {}, form());
  const ledger = await getLedgerForGroup(1);
  ledger.balances.members[0].name = "A very long member name that must wrap without hiding any controls";
  const tree = BalanceList({ ...ledger, access: { kind: "owner", groupId: 1 }, currentMemberId: 10 });
  const rows = nodes(tree).filter(node => node.type === "li");
  assert.equal(rows.length, ledger.balances.members.length);
  for (const row of rows) {
    assert.match(row.props.className, /balance-row/);
    assert.match(nodes(row).find(node => node.type === "h3").props.className, /balance-row-name/);
    assert.match(nodes(row).find(node => node.props?.className?.includes("balance-row-amount")).props.className, /text-right text-base/);
    assert.ok(nodes(row).filter(node => node.type === "details").every(node => !node.props.open));
  }
  const pending = nodes(tree).find(node => node.type === "details" && text(node).includes("View pending reports"));
  assert.ok(pending);
  assert.match(text(pending), /5.00 awaiting confirmation/);
  assert.equal(nodes(pending).filter(node => node.type === PaymentReview).length, 1);
  const historyTree = PaymentPanel({ payments: ledger.payments });
  assert.equal(nodes(historyTree).filter(node => node.type === "details" || node.type === PaymentReview).length, 0);
});

test("disclosure-related rerenders preserve partial amount, selected recipient and retry key", () => {
  const options = props(false);
  let tree = renderWithState(PaymentForm, options);
  nodes(tree).find(node => node.props?.name === "amount").props.onChange({ target: { value: "1.25" } });
  // Native details keep children mounted; an unrelated parent render may supply
  // a new suggested maximum and server key, neither replaces this form intent.
  tree = renderWithState(PaymentForm, { ...options, requestKey: randomUUID(), recipients: [{ id: 10, name: "Owner", maximum: "6.00" }] });
  assert.equal(nodes(tree).find(node => node.props?.name === "amount").props.value, "1.25");
  assert.equal(nodes(tree).find(node => node.props?.name === "receiverMemberId").props.value, "10");
  assert.equal(nodes(tree).find(node => node.props?.name === "requestKey").props.value, options.requestKey);
  assert.match(nodes(tree).find(node => node.props?.["aria-controls"]).props.className, /min-h-11/);
});
