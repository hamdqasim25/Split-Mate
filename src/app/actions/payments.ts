"use server";

import { revalidatePath } from "next/cache";
import { createPayment, reviewPayment, reconcilePayment, PaymentError } from "@/data/payments";
import type { PaymentAccess, PaymentActionState } from "@/lib/payments/types";
import { logPaymentFailure } from "@/lib/payments/diagnostics";

function field(form: FormData, name: string) {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string" || values[0].length > 64) throw new PaymentError("The payment form contains invalid fields.");
  return values[0];
}

function allocations(form: FormData) {
  const ids = form.getAll("allocationExpenseId"), amounts = form.getAll("allocationAmount");
  if (ids.length > 500 || ids.length !== amounts.length || ids.some(id => typeof id !== "string" || id.length > 10) || amounts.some(amount => typeof amount !== "string" || amount.length > 32)) throw new PaymentError("Enter valid expense allocations.");
  return ids.flatMap((expenseId, index) => amounts[index] === "" ? [] : [{ expenseId, amount: amounts[index] }]);
}

async function submit(access: PaymentAccess, form: FormData): Promise<PaymentActionState> {
  let phase: "input" | "transaction" | "refresh" = "input";
  try {
    if (access.kind === "guest" && form.has("payerMemberId")) throw new PaymentError("You can only report your own payment.");
    const input = {
      requestKey: field(form, "requestKey"), amount: field(form, "amount"), receiverMemberId: field(form, "receiverMemberId"),
      allocations: allocations(form),
      ...(access.kind === "owner" ? { payerMemberId: field(form, "payerMemberId") } : {}),
    };
    phase = "transaction";
    const result = await createPayment(access, input);
    phase = "refresh";
    refresh(result);
    return { success: result.replay ? "This payment was already recorded. Check its status in the history." : access.kind === "guest" ? "Payment reported. Awaiting owner confirmation; balances have not changed." : "Completed payment recorded and balances updated." };
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message };
    logPaymentFailure("submit", phase, error);
    return { error: "Unable to record the payment. Retry this same form to avoid a duplicate." };
  }
}

function refresh(result: { groupId: number; shareToken: string }) {
  revalidatePath("/dashboard");
  revalidatePath(`/groups/${result.groupId}`);
  revalidatePath(`/g/${result.shareToken}/group`);
}

export async function ownerPaymentAction(groupId: number, _previous: PaymentActionState, form: FormData) {
  return submit({ kind: "owner", groupId }, form);
}
export async function guestPaymentAction(shareToken: string, _previous: PaymentActionState, form: FormData) {
  return submit({ kind: "guest", shareToken }, form);
}
export async function reviewPaymentAction(groupId: number, paymentId: number, _previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  let phase: "input" | "transaction" | "refresh" = "input";
  try {
    const decision = field(form, "decision");
    phase = "transaction";
    const result = await reviewPayment({ kind: "owner", groupId }, String(paymentId), decision, decision === "confirm" ? field(form, "allocationVersion") : undefined);
    phase = "refresh";
    refresh(result);
    return { success: result.replay ? "This payment was already reviewed." : "Payment reviewed. Balances and history have been refreshed." };
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message };
    logPaymentFailure("review", phase, error);
    return { error: "Unable to review the payment. Please retry; it will not be applied twice." };
  }
}

export async function reconcilePaymentAction(groupId: number, paymentId: number, version: string, _previous: PaymentActionState, form: FormData): Promise<PaymentActionState> {
  try {
    if (form.get("confirmed") !== "yes") throw new PaymentError("Confirm the associations before saving.");
    const result = await reconcilePayment({ kind: "owner", groupId }, String(paymentId), version, allocations(form));
    refresh(result);
    return { success: "Payment allocations saved. Original payment amount and status retained." };
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message };
    logPaymentFailure("review", "transaction", error);
    return { error: "Unable to reconcile this payment. Retry the same form or reopen its history to check the result." };
  }
}
