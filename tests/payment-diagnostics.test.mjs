import assert from "node:assert/strict";
import { test } from "node:test";
import { db, installHooks, reset } from "./helpers/guest-environment.mjs";
const hooks = installHooks();
const { paymentErrorDiagnostic, logPaymentFailure } = await import("../src/lib/payments/diagnostics.ts");
const { guestPaymentAction, reviewPaymentAction } = await import("../src/app/actions/payments.ts");
hooks.deregister();

const privateText = "PRIVATE password connection-string session share-token amount name email";
function sqlError(code) {
  return Object.assign(new Error(privateText), {
    name: "SqlQueryError", sqlState: code, detail: privateText, constraint: privateText,
    query: privateText, parameters: [privateText], cause: Object.assign(new Error(privateText), { code }),
  });
}
test("SQL error wrappers retain actionable codes without values or database details", () => {
  const error = new Error(privateText, { cause: sqlError("42703") });
  const diagnostic = paymentErrorDiagnostic(error);
  assert.deepEqual(diagnostic.codes, ["42703"]);
  assert.deepEqual(diagnostic.diagnoses, ["missing_column"]);
  assert.ok(diagnostic.kinds.includes("SqlQueryError"));
  assert.doesNotMatch(JSON.stringify(diagnostic), /PRIVATE|password|connection-string|share-token|amount|email/);
});
for (const [code, diagnosis] of [["40P01", "transaction_deadlock"], ["40001", "transaction_serialization_failure"], ["23505", "unique_constraint"], ["23503", "foreign_key_constraint"], ["23502", "not_null_constraint"], ["55P03", "lock_unavailable"], ["CONTRACT.MARKER_MISMATCH", "database_contract_mismatch"], ["PLAN.HASH_MISMATCH", "generated_plan_contract_mismatch"]]) {
  test(`classifies ${code} safely`, () => {
    assert.deepEqual(paymentErrorDiagnostic({ details: { cause: { code } }, message: privateText }).diagnoses, [diagnosis]);
  });
}
test("unknown codes, strings, custom names, getters and cycles cannot leak data", () => {
  const error = { code: privateText, name: privateText, message: privateText, toJSON() { throw new Error("must not call"); } };
  error.cause = error;
  Object.defineProperty(error, "details", { get() { throw new Error("must not call"); } });
  assert.deepEqual(paymentErrorDiagnostic(error), { kinds: [], codes: [], diagnoses: ["unclassified_error"] });
  assert.deepEqual(paymentErrorDiagnostic(privateText).codes, []);
});
test("logs fixed operation/phase and distinguishes a post-commit refresh failure", t => {
  const log = t.mock.method(console, "error", () => {});
  logPaymentFailure("submit", "refresh", new TypeError(privateText));
  assert.equal(log.mock.calls[0].arguments[1].commitAcknowledged, true);
  assert.equal(log.mock.calls[0].arguments[1].phase, "refresh");
  assert.doesNotMatch(JSON.stringify(log.mock.calls[0].arguments), /PRIVATE/);
});
test("guest action logs missing-column failure while keeping browser error generic", async t => {
  reset();
  const log = t.mock.method(console, "error", () => {});
  t.mock.method(db, "transaction", async () => { throw sqlError("42703"); });
  const form = new FormData();
  for (const [key, value] of Object.entries({ requestKey: "11111111-1111-4111-8111-111111111111", receiverMemberId: "10", amount: "1.00" })) form.set(key, value);
  const result = await guestPaymentAction(privateText, {}, form);
  assert.equal(result.error, "Unable to record the payment. Retry this same form to avoid a duplicate.");
  assert.deepEqual(log.mock.calls[0].arguments[1].codes, ["42703"]);
  assert.equal(log.mock.calls[0].arguments[1].phase, "transaction");
  assert.equal(log.mock.calls[0].arguments[1].commitAcknowledged, false);
  assert.doesNotMatch(JSON.stringify([result, log.mock.calls[0].arguments]), /PRIVATE/);
});
test("review action logs lock failure while keeping browser error generic", async t => {
  reset();
  const log = t.mock.method(console, "error", () => {});
  t.mock.method(db, "transaction", async () => { throw sqlError("40P01"); });
  const form = new FormData(); form.set("decision", "confirm");
  assert.match((await reviewPaymentAction(1, 1, {}, form)).error, /Unable to review/);
  assert.deepEqual(log.mock.calls[0].arguments[1].codes, ["40P01"]);
  assert.equal(log.mock.calls[0].arguments[1].operation, "review");
});
