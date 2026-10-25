import { ExpenseError } from "@/data/expenses";
import type { ExpenseInput } from "@/lib/expenses/types";

export function readInput(form: FormData): ExpenseInput {
  const field = (name: string, max: number) => {
    const values = form.getAll(name);
    if (values.length !== 1 || typeof values[0] !== "string" || values[0].length > max) {
      throw new ExpenseError("The expense contains invalid form fields.");
    }
    return values[0];
  };
  const participantIds = form.getAll("participantIds");
  if (participantIds.length > 51 || participantIds.some(id => typeof id !== "string" || id.length > 10)) {
    throw new ExpenseError("Choose valid participants.");
  }
  const shareIds = form.getAll("shareMemberId");
  const shareAmounts = form.getAll("shareAmount");
  if (shareIds.length > 51 || shareIds.length !== shareAmounts.length ||
    shareIds.some(id => typeof id !== "string" || id.length > 10) ||
    shareAmounts.some(amount => typeof amount !== "string" || amount.length > 32)) {
    throw new ExpenseError("Enter valid participant shares.");
  }
  // Share values are proposals: the service revalidates their IDs and exact sum.
  // Acting identity, currency and redirect URLs still come only from the server.
  return {
    description: field("description", 1000), amount: field("amount", 32),
    paidByMemberId: field("paidByMemberId", 10), participantIds: participantIds as string[],
    ...(shareIds.length ? { shares: shareIds.map((memberId, index) => ({ memberId: memberId as string, amount: shareAmounts[index] as string })) } : {}),
  };
}

