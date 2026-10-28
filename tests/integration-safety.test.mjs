import assert from "node:assert/strict";
import { test } from "node:test";
import { validateTestURL, assertTestDatabase } from "./integration/config.mjs";
const valid = "postgresql://splitmate_test:local-test-only@127.0.0.1:55439/splitmate_integration";
test("explicit isolated test URL is accepted", () => { assert.equal(validateTestURL(valid), valid); });
for (const [name, value] of [
  ["missing", undefined], ["empty", ""], ["malformed", "bad"],
  ["remote", valid.replace("127.0.0.1", "db.prisma.io")], ["default port", valid.replace("55439", "5432")],
  ["application database", valid.replace("splitmate_integration", "postgres")],
  ["application user", valid.replace("splitmate_test:", "postgres:")],
  ["host override", `${valid}?host=db.prisma.io`], ["fragment", `${valid}#ignored`],
  ["no password", valid.replace(":local-test-only", "")],
]) test(`test configuration fails closed: ${name}`, () => {
  assert.throws(() => validateTestURL(value), error => !error.message.includes("local-test-only") && !error.message.includes("postgresql://"));
});
test("same database via localhost alias is rejected regardless of credentials", () => {
  assert.throws(() => validateTestURL(valid, [valid.replace("127.0.0.1", "localhost").replace("local-test-only", "other")]), /Refusing application/);
});
test("application credentials cannot be reused on a different endpoint", () => {
  assert.throws(() => validateTestURL(valid, [valid.replace("55439", "55440")]), /reused application credentials/);
});
test("live database marker is mandatory", async () => {
  // Only this configuration unit test uses a stub; integration SQL never does.
  await assert.rejects(assertTestDatabase({ query: async () => ({ rows: [{ db: "splitmate_integration", username: "splitmate_test", marker: null }] }) }), /marker mismatch/);
});
