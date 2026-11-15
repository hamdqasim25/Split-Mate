import { formatPence } from "@/lib/expenses/money";

/** Display-only recognition of existing descriptions, never an authority for event behaviour.
 * Unknown/ambiguous records keep their full text in the disclosure instead of leaking audit IDs. */
export function activitySummary(description: string): string {
  const simple = description.match(/^(.{1,80}) (joined the group|created the group)$/u);
  if (simple && !/[#;\n]/u.test(simple[1])) return description;
  const expense = description.match(/^(.{1,80}) (added|deleted) ".*" — £(\d+\.\d{2})(?:\.|$)/u);
  if (expense && !/[#;\n]/u.test(expense[1])) return `${expense[1]} ${expense[2]} an expense — £${expense[3]}`;
  const payment = description.match(/^(.{1,80}) (reported a payment|recorded a completed payment|confirmed a payment|rejected a payment) of £(\d+\.\d{2})(?:;|$)/u);
  if (payment && !/[#;\n]/u.test(payment[1])) return `${payment[1]} ${payment[2]} — £${payment[3]}`;
  if (/^.{1,80} updated "/u.test(description)) return "An expense was updated";
  if (/^.{1,80} explicitly reconciled payment #\d+\./u.test(description)) return "Payment expense links were reviewed";
  const exclusion = description.match(/^.{1,80} excluded (\d+) pence of payment #\d+ because expense "/u);
  if (exclusion) return `Payment amount excluded after expense deletion — £${formatPence(BigInt(exclusion[1]))}`;
  return "Group activity recorded";
}
