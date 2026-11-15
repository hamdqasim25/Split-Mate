import assert from "node:assert/strict";
import { test } from "node:test";
import { installHooks } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { formatHistoryTime } = await import("../src/lib/date-time.ts");
const { activitySummary } = await import("../src/lib/activity-summary.ts");
const { default: ActivityList } = await import("../src/components/groups/activity-list.tsx");
const { default: PaymentHistory, PaymentReview } = await import("../src/components/groups/payment-panel.tsx");
hooks.deregister();

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return tree && typeof tree === "object" ? [tree, ...nodes(tree.props?.children)] : [];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree == null || typeof tree === "boolean") return "";
  return typeof tree === "object" ? text(tree.props?.children) : String(tree);
}
const timestamp = "2026-11-07T14:35:59.123Z";
const payment = { id: 1, payerMemberId: 2, receiverMemberId: 3, payerName: "Ahmed", receiverName: "Yusuf", amount: "25.00", status: "SENT", createdAt: timestamp, sentAt: timestamp, confirmedAt: null,
  allocations: [{ expenseId: 4, description: "Dinner", amountPence: "2500", valid: true, excluded: false }] };

test("history dates use UK ordering, 24-hour minutes and London winter/summer time", () => {
  assert.equal(formatHistoryTime(timestamp), "7 Nov, 14:35");
  assert.equal(formatHistoryTime(timestamp, true), "7 November 2026, 14:35");
  assert.equal(formatHistoryTime("2026-07-07T08:05:00Z"), "7 Jul, 09:05");
  assert.equal(formatHistoryTime("2026-11-07T00:05:00Z"), "7 Nov, 00:05");
  assert.equal(formatHistoryTime("invalid"), "Date unavailable");
});
test("London daylight saving boundaries retain the actual instant", () => {
  for (const [instant, expected] of [
    ["2026-03-29T00:59:00Z", "29 Mar, 00:59"], ["2026-03-29T01:00:00Z", "29 Mar, 02:00"],
    ["2026-10-25T00:59:00Z", "25 Oct, 01:59"], ["2026-10-25T01:00:00Z", "25 Oct, 01:00"],
    ["2026-07-07T23:30:00Z", "8 Jul, 00:30"],
  ]) assert.equal(formatHistoryTime(instant), expected);
});
test("activity summaries remove audit details and convert integer pennies exactly", () => {
  for (const [original, expected] of [
    ['Ahmed added "Dinner" — £40.00', "Ahmed added an expense — £40.00"],
    ['Ahmed deleted "Dinner" — £40.00. Linked repayment allocations are excluded.', "Ahmed deleted an expense — £40.00"],
    ["Yusuf reported a payment of £15.00; allocations: expense #4 (Dinner) £15.00", "Yusuf reported a payment — £15.00"],
    ["Ahmed confirmed a payment of £15.00; £10.00 applies to remaining expenses", "Ahmed confirmed a payment — £15.00"],
    ["Ahmed rejected a payment of £15.00", "Ahmed rejected a payment — £15.00"],
    ["Ahmed recorded a completed payment of £15.00; allocations: expense #4", "Ahmed recorded a completed payment — £15.00"],
    ["Sara joined the group", "Sara joined the group"],
    ["Sara created the group", "Sara created the group"],
    ['Sara updated "Dinner" — total £15.00 → £20.00', "An expense was updated"],
    ["Sara explicitly reconciled payment #42. Previous associations: expense #4", "Payment expense links were reviewed"],
    ['Sara excluded 1001 pence of payment #42 because expense "Dinner" was deleted.', "Payment amount excluded after expense deletion — £10.01"],
    ["UNKNOWN_EVENT payment #42", "Group activity recorded"],
  ]) assert.equal(activitySummary(original), expected);
});
test("activity keeps full original text and timestamps outside the compact summary", () => {
  const description = "Yusuf reported a payment of £15.00; allocations: expense #4 (Dinner) £15.00";
  const tree = ActivityList({ activity: [{ id: 1, description, createdAt: timestamp }, { id: 2, description: "UNKNOWN_EVENT #42", createdAt: timestamp }] });
  const details = nodes(tree).filter(node => node.type === "details");
  assert.equal(details.length, 2);
  for (const disclosure of details) {
    assert.equal(disclosure.props.open, undefined);
    assert.equal(disclosure.props.name, undefined, "no exclusive accordion grouping");
    assert.equal(disclosure.props.children[0].type, "summary");
    assert.doesNotMatch(text(disclosure.props.children[0]), /#4|allocations|UNKNOWN_EVENT/);
  }
  assert.ok(text(tree).includes(description));
  assert.ok(text(tree).includes("UNKNOWN_EVENT #42"));
  assert.match(text(tree), /7 November 2026, 14:35/);
  assert.ok(nodes(tree).filter(node => node.type === "time").every(node => node.props.dateTime === timestamp));
});
test("payment summaries show sender, recipient, GBP, status and short date only", () => {
  for (const [status, label] of [["SENT", "Sent"], ["CONFIRMED", "Confirmed"], ["REJECTED", "Rejected"]]) {
    const tree = PaymentHistory({ payments: [{ ...payment, status, confirmedAt: status === "CONFIRMED" ? timestamp : null }] });
    const disclosure = nodes(tree).find(node => node.type === "details");
    const summary = disclosure.props.children[0];
    assert.equal(summary.type, "summary");
    assert.match(text(summary), /Ahmed → Yusuf£25.00/);
    assert.ok(text(summary).includes(label));
    assert.match(text(summary), /7 Nov, 14:35/);
    assert.doesNotMatch(text(summary), /Dinner|2500|Recorded|London/);
    assert.equal(nodes(summary).filter(node => ["a", "button", "form", "input"].includes(node.type)).length, 0);
    assert.equal(disclosure.props.open, undefined);
    assert.match(text(tree), /7 November 2026, 14:35/);
    assert.equal(nodes(tree).filter(node => node.type === PaymentReview).length, 0);
    const allocation = nodes(tree).find(node => typeof node.type === "function" && node.type.name === "PaymentAllocations");
    assert.match(text(allocation.type(allocation.props)), /Dinner — £25.00/);
  }
});
test("urgent owner review and unresolved reconciliation remain outside collapsed details", () => {
  for (const allocations of [undefined, [{ ...payment.allocations[0], excluded: true }]]) {
    const tree = PaymentHistory({ payments: [{ ...payment, allocations }], ownerGroupId: 1, currentMemberId: 3 });
    const disclosure = nodes(tree).find(node => node.type === "details");
    assert.equal(nodes(disclosure).filter(node => node.type === PaymentReview).length, 0);
    const review = nodes(tree).find(node => node.type === PaymentReview);
    assert.equal(review.props.canConfirm, false);
    if (!allocations) {
      assert.ok(nodes(tree).some(node => node.props.href === "/groups/1/payments/1/reconcile"));
      assert.ok(!nodes(disclosure).some(node => node.props.href));
    }
  }
});
test("empty history states stay readable", () => {
  assert.match(text(PaymentHistory({ payments: [] })), /No repayments recorded yet/);
  assert.match(text(ActivityList({ activity: [] })), /No activity yet/);
});
