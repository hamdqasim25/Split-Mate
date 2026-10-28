"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createExpense, ExpenseError, previewExpense, validateExpenseRequestKey } from "@/data/expenses";
import type { ExpenseAccess, ExpenseFormState, ExpenseInput } from "@/lib/expenses/types";

import { readInput } from "@/lib/expenses/form-input";

async function handleExpense(access: ExpenseAccess, form: FormData): Promise<ExpenseFormState> {
  let input: ExpenseInput | undefined;
  let saved: Awaited<ReturnType<typeof createExpense>>;
  let requestKey: string | undefined;
  try {
    const keys = form.getAll("requestKey");
    validateExpenseRequestKey(keys.length === 1 ? keys[0] : undefined);
    requestKey = keys[0] as string;
    input = readInput(form);
    const intent = form.get("intent");
    if (intent === "edit") return { requestKey, input: { description: input.description, amount: input.amount, paidByMemberId: input.paidByMemberId, participantIds: input.participantIds } };
    if (intent === "review") return { ...await previewExpense(access, input), requestKey };
    if (intent !== "save" || form.get("confirmed") !== "yes") throw new ExpenseError("Review the split before saving.");
    if (!input.shares) throw new ExpenseError("Enter exactly one share for each participant.");
    saved = await createExpense(access, input, requestKey);
  } catch (error) {
    const message = error instanceof ExpenseError ? error.message : "Unable to save or review this expense. Please try again.";
    if (!(error instanceof ExpenseError)) console.error("Expense submission failed unexpectedly.");
    // Reload a safe equal baseline, but retain the user's raw editable shares.
    // Never use previous action state as proof of identity or as trusted amounts.
    if (input?.shares) {
      try {
        const baseline = await previewExpense(access, { description: input.description, amount: input.amount, paidByMemberId: input.paidByMemberId, participantIds: input.participantIds });
        return { input, review: baseline.review, error: message, requestKey };
      } catch { /* Access/member changes require returning to the details form. */ }
    }
    return { input, error: message, requestKey };
  }
  // Commit precedes navigation. Do not convert a redirect into a save error.
  const destination = access.kind === "owner" ? `/groups/${saved.groupId}` : `/g/${access.shareToken}/group`;
  try {
    revalidatePath(destination);
    revalidatePath("/dashboard");
  } catch {
    return { input, requestKey, savedDestination: destination };
  }
  redirect(destination);
}

export async function ownerExpenseAction(groupId: number, _previous: ExpenseFormState, form: FormData) {
  return handleExpense({ kind: "owner", groupId }, form);
}

export async function guestExpenseAction(shareToken: string, _previous: ExpenseFormState, form: FormData) {
  return handleExpense({ kind: "guest", shareToken }, form);
}
