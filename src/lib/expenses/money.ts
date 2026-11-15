// GBP only in this milestone. All arithmetic is integer pence; Decimal columns
// receive exact pound strings, never floating-point pound values.
export const MAX_PENCE = 99_999_999_999;

/**
 * Parse a plain GBP string into integer pennies within the single-record limit.
 * Zero is allowed only when requested for a participant share. The bound fits
 * safely in Number; larger ledger aggregates use bigint instead.
 * @throws RangeError for unsupported notation, precision, sign or amount.
 */
export function parsePence(value: unknown, allowZero = false): number {
  if (typeof value !== "string" || value.length > 32) throw new RangeError("Enter a valid GBP amount.");
  const match = /^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError("Enter pounds with up to two decimal places, without commas or currency symbols.");
  const pence = BigInt(match[1]) * BigInt(100) + BigInt((match[2] ?? "").padEnd(2, "0"));
  if ((!allowZero && pence === BigInt(0)) || pence > BigInt(MAX_PENCE)) throw new RangeError(allowZero ? "Enter a share from £0.00 to £999,999,999.99." : "Enter an amount from £0.01 to £999,999,999.99.");
  return Number(pence);
}

/** Signed display totals can exceed one expense's bound while a user edits. */
export function formatPence(value: bigint): string {
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, "0")}`;
}

/** Summarize a draft split without treating malformed shares as valid zeroes.
 * Invalid entries are omitted from the displayed sum but make balanced false.
 * The expense total itself must already be valid and may throw RangeError. */
export function splitTotals(total: string, shares: string[]) {
  const expense = BigInt(parsePence(total));
  let assigned = BigInt(0);
  let valid = shares.length > 0;
  for (const share of shares) {
    try { assigned += BigInt(parsePence(share, true)); }
    catch { valid = false; }
  }
  return {
    assigned: formatPence(assigned), remaining: formatPence(expense - assigned),
    valid, balanced: valid && assigned === expense,
  };
}

/** Encode bounded non-negative pennies as an exact pound string for Decimal columns. */
export function penceToDecimal(pence: number): string {
  if (!Number.isSafeInteger(pence) || pence < 0 || pence > MAX_PENCE) throw new RangeError("Invalid pence value.");
  const integer = BigInt(pence);
  return `${integer / BigInt(100)}.${String(integer % BigInt(100)).padStart(2, "0")}`;
}

/**
 * Divide positive pennies across distinct members, ordered by ascending ID.
 * Give one leftover penny to each earliest ID until the remainder is exhausted.
 * This preserves the total and makes checkbox/input order irrelevant; zero shares
 * are possible when there are fewer pennies than participants.
 * @returns Shares in ascending member-ID order, without mutating the input list.
 * @throws RangeError for invalid totals, IDs, duplicates or an empty membership list.
 */
export function equalSplit(totalPence: number, memberIds: number[]) {
  if (!Number.isSafeInteger(totalPence) || totalPence <= 0 || totalPence > MAX_PENCE || memberIds.length === 0 ||
    memberIds.some(id => !Number.isInteger(id) || id <= 0 || id > 2_147_483_647) || new Set(memberIds).size !== memberIds.length) {
    throw new RangeError("Invalid equal split.");
  }
  const sorted = [...memberIds].sort((a, b) => a - b);
  const count = BigInt(sorted.length);
  const base = BigInt(totalPence) / count;
  const remainder = BigInt(totalPence) % count;
  return sorted.map((memberId, index) => ({ memberId, pence: Number(base + (BigInt(index) < remainder ? BigInt(1) : BigInt(0))) }));
}
