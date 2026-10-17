import assert from "node:assert/strict";
import { test } from "node:test";
import { equalSplit, parsePence, penceToDecimal, MAX_PENCE, splitTotals, formatPence } from "../src/lib/expenses/money.ts";

test("parses pounds as exact integer pence and formats Decimal strings", () => {
  for (const [value, expected] of [["0.01", 1], ["0.10", 10], ["1", 100], ["1.2", 120], [" 10.00 ", 1000], ["999999999.99", MAX_PENCE]]) {
    assert.equal(parsePence(value), expected);
    assert.equal(parsePence(penceToDecimal(expected)), expected);
  }
  assert.equal(penceToDecimal(0), "0.00");
  assert.equal(penceToDecimal(334), "3.34");
});
for (const value of ["", " ", "0", "0.00", "-1", "1.001", "1e2", "Infinity", "NaN", "£1", "1,000", "01", ".5", "1.", "1000000000", 10, null, undefined]) {
  test(`rejects invalid amount ${JSON.stringify(value)}`, () => assert.throws(() => parsePence(value), RangeError));
}
test("remainder follows ascending member ID, independent of submission order", () => {
  const expected = [{ memberId: 2, pence: 334 }, { memberId: 7, pence: 333 }, { memberId: 10, pence: 333 }];
  const ids = [10, 2, 7];
  assert.deepEqual(equalSplit(1000, ids), expected);
  assert.deepEqual(equalSplit(1000, [7, 10, 2]), expected);
  assert.deepEqual(ids, [10, 2, 7]);
});
test("even, single-participant and sub-penny-per-person splits preserve every penny", () => {
  assert.deepEqual(equalSplit(1000, [1, 2]).map(row => row.pence), [500, 500]);
  assert.deepEqual(equalSplit(1000, [1]).map(row => row.pence), [1000]);
  assert.deepEqual(equalSplit(1, [1, 2, 3]).map(row => row.pence), [1, 0, 0]);
  for (const total of [1, 2, 10, 1000, MAX_PENCE]) for (const count of [1, 2, 3, 51]) {
    const shares = equalSplit(total, Array.from({ length: count }, (_, i) => i + 1)).map(row => row.pence);
    assert.equal(shares.reduce((sum, share) => sum + share, 0), total);
    assert.ok(Math.max(...shares) - Math.min(...shares) <= 1);
  }
});
test("split and formatting reject unsafe inputs", () => {
  for (const ids of [[], [1, 1], [0], [-1], [1.5], [2147483648]]) assert.throws(() => equalSplit(100, ids), RangeError);
  for (const total of [0, -1, 0.5, NaN, MAX_PENCE + 1]) assert.throws(() => equalSplit(total, [1]), RangeError);
  for (const total of [-1, 0.5, NaN, MAX_PENCE + 1]) assert.throws(() => penceToDecimal(total), RangeError);
});
test("share parsing accepts zero but still rejects negatives and fractional pennies", () => {
  assert.equal(parsePence("0.00", true), 0);
  for (const value of ["-0.01", "-0", "0.001"]) assert.throws(() => parsePence(value, true), RangeError);
});
test("assigned and remaining use exact integer sums including overspending", () => {
  assert.deepEqual(splitTotals("0.30", ["0.1", "0.2"]), { assigned: "0.30", remaining: "0.00", valid: true, balanced: true });
  assert.deepEqual(splitTotals("10", ["5", "3", "1"]), { assigned: "9.00", remaining: "1.00", valid: true, balanced: false });
  assert.deepEqual(splitTotals("10", ["5", "3", "3"]), { assigned: "11.00", remaining: "-1.00", valid: true, balanced: false });
  assert.equal(formatPence(BigInt(-1)), "-0.01");
});
test("invalid values never count as valid zero shares and aggregate totals cannot overflow", () => {
  assert.equal(splitTotals("10", ["10", ""]).balanced, false);
  assert.equal(splitTotals("10", ["10", "-1"]).valid, false);
  assert.equal(splitTotals("10", []).valid, false);
  assert.equal(splitTotals("1", Array(51).fill("999999999.99")).assigned, "50999999999.49");
});
