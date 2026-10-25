"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ExpenseError } from "@/data/expenses";
import { getSavedExpenseForOwner, previewSavedExpense, updateSavedExpense, deleteSavedExpense } from "@/data/expense-management";
import { readInput } from "@/lib/expenses/form-input";
import type { ExpenseFormState, ExpenseInput } from "@/lib/expenses/types";

function refresh(result: { groupId: number; shareToken: string }, status: string): never {
  revalidatePath(`/groups/${result.groupId}`);
  revalidatePath(`/g/${result.shareToken}/group`);
  revalidatePath("/dashboard");
  redirect(`/groups/${result.groupId}?expense=${status}`);
}

export async function editExpenseAction(groupId: number, expenseId: number, version: string, _previous: ExpenseFormState, form: FormData): Promise<ExpenseFormState> {
  let input: ExpenseInput | undefined;
  let result;
  try {
    input = readInput(form);
    const intent = form.get("intent");
    if (intent === "edit") {
      await getSavedExpenseForOwner(groupId, expenseId);
      return { input };
    }
    if (intent === "review") return await previewSavedExpense(groupId, expenseId, version, input);
    if (intent !== "save" || form.get("confirmed") !== "yes") throw new ExpenseError("Review the split before saving.");
    result = await updateSavedExpense(groupId, expenseId, version, input);
  } catch (error) {
    const message = error instanceof ExpenseError ? error.message : "Unable to save this expense. Reopen it to check whether the change was saved before trying again.";
    if (!(error instanceof ExpenseError)) console.error("Saved expense update failed unexpectedly.");
    if (input) {
      try { return { ...await previewSavedExpense(groupId, expenseId, version, input), error: message }; }
      catch { /* Preserve entered details even after access/version changes. */ }
    }
    return { input, error: message };
  }
  refresh(result, "updated");
}

export async function deleteExpenseAction(groupId: number, expenseId: number, version: string, _previous: { error?: string }, form: FormData) {
  let result;
  try {
    if (form.get("confirmed") !== "yes") throw new ExpenseError("Confirm the expense deletion first.");
    result = await deleteSavedExpense(groupId, expenseId, version);
  } catch (error) {
    if (!(error instanceof ExpenseError)) console.error("Saved expense deletion failed unexpectedly.");
    return { error: error instanceof ExpenseError ? error.message : "Unable to delete this expense. Reopen it to check its current state before trying again." };
  }
  refresh(result, "deleted");
}
