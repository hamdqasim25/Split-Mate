"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createExpense, ExpenseError, previewExpense } from "@/data/expenses";
import type { ExpenseAccess, ExpenseFormState, ExpenseInput } from "@/lib/expenses/types";

function readInput(form: FormData): ExpenseInput {
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

async function handleExpense(access: ExpenseAccess, form: FormData): Promise<ExpenseFormState> {
  let input: ExpenseInput | undefined;
  let saved: Awaited<ReturnType<typeof createExpense>>;
  try {
    input = readInput(form);
    const intent = form.get("intent");
    if (intent === "edit") return { input: { description: input.description, amount: input.amount, paidByMemberId: input.paidByMemberId, participantIds: input.participantIds } };
    if (intent === "review") return await previewExpense(access, input);
    if (intent !== "save" || form.get("confirmed") !== "yes") throw new ExpenseError("Review the split before saving.");
    if (!input.shares) throw new ExpenseError("Enter exactly one share for each participant.");
    saved = await createExpense(access, input);
  } catch (error) {
    const message = error instanceof ExpenseError ? error.message : "Unable to save or review this expense. Please try again.";
    if (!(error instanceof ExpenseError)) console.error("Expense submission failed unexpectedly.");
    // Reload a safe equal baseline, but retain the user's raw editable shares.
    // Never use previous action state as proof of identity or as trusted amounts.
    if (input?.shares) {
      try {
        const baseline = await previewExpense(access, { description: input.description, amount: input.amount, paidByMemberId: input.paidByMemberId, participantIds: input.participantIds });
        return { input, review: baseline.review, error: message };
      } catch { /* Access/member changes require returning to the details form. */ }
    }
    return { input, error: message };
  }
  // Commit precedes navigation. Do not convert a redirect into a save error.
  const destination = access.kind === "owner" ? `/groups/${saved.groupId}` : `/g/${access.shareToken}/group`;
  revalidatePath(destination);
  revalidatePath("/dashboard");
  redirect(destination);
}

export async function ownerExpenseAction(groupId: number, _previous: ExpenseFormState, form: FormData) {
  return handleExpense({ kind: "owner", groupId }, form);
}

export async function guestExpenseAction(shareToken: string, _previous: ExpenseFormState, form: FormData) {
  return handleExpense({ kind: "guest", shareToken }, form);
}
