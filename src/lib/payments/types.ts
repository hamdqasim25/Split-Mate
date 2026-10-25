export type PaymentAccess = { kind: "owner"; groupId: number } | { kind: "guest"; shareToken: string };
export type PaymentStatus = "SENT" | "CONFIRMED" | "REJECTED";
export type PaymentRecord = {
  id: number; payerMemberId: number; receiverMemberId: number; amount: string;
  status: string; createdAt: string; sentAt: string | null; confirmedAt: string | null;
  allocations?: PaymentAllocation[];
  allocationVersion?: string;
};
export type PaymentAllocation = { expenseId: number; description: string; amountPence: string; excluded: boolean; valid: boolean };
export type PaymentExpense = { id: number; description: string; paidByMemberId: number; shares: { memberId: number; amount: string }[] };
export type PaymentHistory = PaymentRecord & { payerName: string; receiverName: string };
export type PaymentActionState = { error?: string; success?: string };
export const paymentStatusLabel = (status: string) => status === "SENT" ? "Awaiting confirmation"
  : status === "CONFIRMED" ? "Confirmed" : status === "REJECTED" ? "Rejected" : "Unknown status";
