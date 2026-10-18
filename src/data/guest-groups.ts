import "server-only";

import { db } from "@/prisma/db";
import { findInviteGroup } from "@/data/invites";
import { getGuestSessionForGroup, recordGuestActivity } from "@/lib/auth/guest-session";
import { isValidToken } from "@/lib/auth/tokens";
import { getExpensesForGroup } from "@/data/groups";
import { getLedgerForGroup } from "@/data/balances";

/** Cookie authentication is authoritative; the URL only identifies the group. */
export async function getGroupForGuest(shareToken: unknown) {
  if (!isValidToken(shareToken)) return null;
  return db.transaction(async (tx) => {
    const group = await findInviteGroup(shareToken, tx);
    if (!group) return null;
    const guest = await getGuestSessionForGroup(group.id, tx);
    if (!guest) return null;

    // Disabling sharing blocks invitations, not existing membership. Only
    // explicitly guest-visible activity types load in this milestone.
    const members = await tx.orm.public.GroupMember.where({ groupId: group.id, isActive: true })
      .select("id", "name", "claimedAt")
      .orderBy([(member) => member.addedAt.asc(), (member) => member.id.asc()]).all();
    const activity = await tx.orm.public.ActivityEvent.where({ groupId: group.id })
      .where((event) => event.eventType.in(["GROUP_CREATED", "MEMBER_CLAIMED", "MEMBER_ADDED", "MEMBER_REMOVED", "EXPENSE_CREATED", "PAYMENT_SENT", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "PAYMENT_RECORDED"]))
      .select("id", "description", "createdAt")
      .orderBy([(event) => event.createdAt.desc(), (event) => event.id.desc()])
      .limit(10).all();

    const expenses = await getExpensesForGroup(group.id, tx);
    const ledger = await getLedgerForGroup(group.id, tx);
    await recordGuestActivity(guest, tx);
    return {
      group: { id: group.id, name: group.name },
      currentGuest: { id: guest.member.id, name: guest.member.name },
      members: members.map((member) => ({ id: member.id, name: member.name, joined: member.claimedAt !== null })),
      activity,
      expenses,
      ...ledger,
    };
  });
}
