import "server-only";

import { db } from "@/prisma/db";
import { getCurrentUser } from "@/lib/auth/session";

export class GroupDeletionError extends Error {}

const unavailable = "This group or your owner access is no longer available. Return to the dashboard.";

/** Authenticate on the transaction connection, never from a supplied owner/member ID. */
export async function deleteGroupForOwner(groupId: number) {
  if (!Number.isInteger(groupId) || groupId <= 0 || groupId > 2_147_483_647) {
    throw new GroupDeletionError(unavailable);
  }
  return db.transaction(async tx => {
    const user = await getCurrentUser(tx);
    if (!user) throw new GroupDeletionError(unavailable);

    // The same row lock used by financial writes and claims, for any currency
    // and even disabled links. updateAll keeps authorization in the SQL WHERE.
    const [group] = await tx.orm.public.Group.where({ id: groupId, createdBy: user.id })
      .select("id", "shareToken").updateAll({ createdBy: user.id });
    if (!group) throw new GroupDeletionError(unavailable);
    const currentUser = await getCurrentUser(tx);
    if (currentUser?.id !== user.id) throw new GroupDeletionError(unavailable);

    const members = await tx.orm.public.GroupMember.where({ groupId }).select("id").all();
    const expenses = await tx.orm.public.Expense.where({ groupId }).select("id").all();
    const payments = await tx.orm.public.Payment.where({ groupId }).select("id").all();

    // Explicit dependency order includes inactive members and soft-deleted
    // expenses. Do not cascade into User or UserSession, or touch other groups.
    if (members.length) {
      await tx.orm.public.GuestSession.where(row => row.groupMemberId.in(members.map(member => member.id))).deleteAll();
    }
    if (payments.length) {
      await tx.orm.public.PaymentAllocation.where(row => row.paymentId.in(payments.map(payment => payment.id))).deleteAll();
    }
    if (expenses.length) {
      await tx.orm.public.ExpenseParticipant.where(row => row.expenseId.in(expenses.map(expense => expense.id))).deleteAll();
    }
    await tx.orm.public.Payment.where({ groupId }).deleteAll();
    await tx.orm.public.Expense.where({ groupId }).deleteAll();
    await tx.orm.public.ActivityEvent.where({ groupId }).deleteAll();
    await tx.orm.public.GroupMember.where({ groupId }).deleteAll();
    await tx.orm.public.Group.where({ id: groupId, createdBy: user.id }).deleteAll();
    return group;
  });
}
