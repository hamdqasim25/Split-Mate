"use server";

import { revalidatePath } from "next/cache";
import { createPayment, reviewPayment, PaymentError } from "@/data/payments";
import type { PaymentAccess, PaymentActionState } from "@/lib/payments/types";
import { logPaymentFailure } from "@/lib/payments/diagnostics";

function field(form: FormData, name: string) {
  const values = form.getAll(name);
  if (values.length !== 1 || typeof values[0] !== "string" || values[0].length > 64) throw new PaymentError("The payment form contains invalid fields.");
  return values[0];
}

async function submit(access: PaymentAccess, form: FormData): Promise<PaymentActionState> {
  let phase: "input" | "transaction" | "refresh" = "input";
  try {
    if (access.kind === "guest" && form.has("payerMemberId")) throw new PaymentError("You can only report your own payment.");
    const input = {
      requestKey: field(form, "requestKey"), amount: field(form, "amount"), receiverMemberId: field(form, "receiverMemberId"),
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
    const result = await reviewPayment({ kind: "owner", groupId }, String(paymentId), decision);
    phase = "refresh";
    refresh(result);
    return { success: result.replay ? "This payment was already reviewed." : "Payment reviewed. Balances and history have been refreshed." };
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message };
    logPaymentFailure("review", phase, error);
    return { error: "Unable to review the payment. Please retry; it will not be applied twice." };
  }
}
