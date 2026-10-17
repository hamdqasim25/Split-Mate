import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { installHooks, reset, renderWithState } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { default: Review } = await import("../src/components/expenses/expense-review.tsx");
hooks.deregister();
beforeEach(reset);
const props = () => ({
  input: { description: "Court", amount: "10.00", paidByMemberId: "10", participantIds: ["10", "2", "7"] },
  review: { description: "Court", amount: "10.00", payer: { id: 10, name: "Hamdi" }, participants: [
    { id: 10, name: "Hamdi", amount: "3.33" }, { id: 2, name: "Ismaeel", amount: "3.34" }, { id: 7, name: "Jaher", amount: "3.33" },
  ] }, action: () => {}, pending: false,
});
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
const render = input => renderWithState(Review, input);
const save = tree => nodes(tree).find(node => node.props.value === "save");
function edit(tree, id, value) { nodes(tree).find(node => node.props.id === `share-${id}`).props.onChange({ target: { value } }); }
test("review keeps supplied natural order, renders labelled shares and balanced totals", () => {
  const tree = render(props());
  assert.deepEqual(nodes(tree).filter(node => node.type === "label").map(text), ["Hamdi", "Ismaeel", "Jaher"]);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareMemberId").map(node => node.props.value), [10, 2, 7]);
  assert.deepEqual(nodes(tree).filter(node => node.type === "dd").map(text), ["£10.00", "£10.00", "£0.00"]);
  assert.equal(save(tree).props.disabled, false);
});
test("editing to 5/3/2 persists values in fields and updates totals exactly", () => {
  const input = props(); let tree = render(input);
  edit(tree, 10, "5.00"); edit(tree, 2, "3.00"); edit(tree, 7, "2.00"); tree = render(input);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareAmount").map(node => node.props.value), ["5.00", "3.00", "2.00"]);
  assert.equal(save(tree).props.disabled, false);
  assert.match(text(tree), /All assigned/);
});
for (const [label, amount, assigned, remaining] of [
  ["under", "1.00", "7.67", "2.33"], ["over", "9.00", "15.67", "-5.67"],
]) test(`${label}-assigned shares disable saving and display exact remaining`, () => {
  const input = props(); let tree = render(input); edit(tree, 10, amount); tree = render(input);
  assert.equal(save(tree).props.disabled, true);
  assert.deepEqual(nodes(tree).filter(node => node.type === "dd").map(text), ["£10.00", `£${assigned}`, `£${remaining}`]);
  let prevented = false;
  tree.props.onSubmit({ nativeEvent: { submitter: { value: "save" } }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
});
for (const invalid of ["-1", "", "1.001", "1e2", "NaN"]) test(`invalid share ${JSON.stringify(invalid)} blocks saving`, () => {
  const input = props(); let tree = render(input); edit(tree, 10, invalid); tree = render(input);
  assert.equal(save(tree).props.disabled, true); assert.match(text(tree), /non-negative/);
});
test("reset restores original equal amounts without changing participant order", () => {
  const input = props(); let tree = render(input); edit(tree, 10, "9"); tree = render(input);
  nodes(tree).find(node => node.type === "button" && text(node) === "Reset to equal split").props.onClick(); tree = render(input);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareAmount").map(node => node.props.value), ["3.33", "3.34", "3.33"]);
  assert.deepEqual(nodes(tree).filter(node => node.type === "label").map(text), ["Hamdi", "Ismaeel", "Jaher"]);
  assert.equal(save(tree).props.disabled, false);
});
test("failed submission restores raw custom shares and exposes an accessible error", () => {
  const input = props(); input.input.shares = [{ memberId: "10", amount: "-1" }, { memberId: "2", amount: "6" }, { memberId: "7", amount: "5" }]; input.error = "Fix the shares.";
  const tree = render(input);
  assert.deepEqual(nodes(tree).filter(node => node.props.name === "shareAmount").map(node => node.props.value), ["-1", "6", "5"]);
  assert.equal(text(nodes(tree).find(node => node.props.role === "alert")), "Fix the shares.");
  assert.equal(save(tree).props.disabled, true);
});
test("zero shares are accepted when the total matches and pending prevents repeat actions", () => {
  const input = props(); let tree = render(input);
  edit(tree, 10, "10"); edit(tree, 2, "0"); edit(tree, 7, "0"); tree = render(input);
  assert.equal(save(tree).props.disabled, false);
  input.pending = true; tree = render(input);
  assert.ok(nodes(tree).filter(node => node.type === "button").every(node => node.props.disabled));
  assert.equal(nodes(tree).find(node => node.type === "fieldset").props.disabled, true);
});
