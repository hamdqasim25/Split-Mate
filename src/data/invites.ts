import "server-only";

import { db } from "@/prisma/db";
import { createSessionToken, isValidToken } from "@/lib/auth/tokens";

export class InviteError extends Error {}

const eligible = { isActive: true, claimedAt: null, userId: null, role: "MEMBER" } as const;

/** Internal lookup, not authentication. Invite disabling only prevents new claims. */
export async function findInviteGroup(shareToken: unknown, client: Pick<typeof db, "orm"> = db) {
  if (!isValidToken(shareToken)) return null;
  return client.orm.public.Group.select("id", "name", "shareLinkEnabled").first({ shareToken });
}

export async function resolveInvite(shareToken: unknown) {
  const group = await findInviteGroup(shareToken);
  if (!group) return { status: "invalid" } as const;
  if (!group.shareLinkEnabled) return { status: "disabled" } as const;
  const members = await db.orm.public.GroupMember
    .where({ groupId: group.id, ...eligible }).select("id", "name")
    .orderBy((member) => member.id.asc()).all();
  return { status: "valid", group: { id: group.id, name: group.name }, members } as const;
}

/** Internal service. The raw token returned here must only be issued as an HttpOnly cookie. */
export async function claimMember(shareToken: unknown, memberId: unknown) {
  if (!isValidToken(shareToken)) throw new InviteError("This invite link is no longer active.");
  if (typeof memberId !== "number" || !Number.isInteger(memberId) || memberId <= 0 || memberId > 2_147_483_647) {
    throw new InviteError("Choose an available member name.");
  }
  const { token, hash } = createSessionToken();
  const now = new Date();
  const timestamp = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    // A conditional no-op update locks the group until commit. Link disabling or
    // rotation cannot slip between invite validation and the member claim.
    // Use updateAll: this RC's update() first reads an ID and then drops the
    // original predicates. updateAll keeps the guards in the SQL UPDATE itself.
    const [group] = await tx.orm.public.Group.where({ shareToken, shareLinkEnabled: true })
      .select("id").updateAll({ shareLinkEnabled: true });
    if (!group) throw new InviteError("This invite link is no longer active.");

    // PostgreSQL rechecks this predicate after waiting for a competing update.
    // Only the request that changes an unclaimed row may create a session.
    const [member] = await tx.orm.public.GroupMember
      .where({ id: memberId, groupId: group.id, ...eligible }).select("id", "name")
      .updateAll({ claimedAt: timestamp, lastActiveAt: timestamp });
    if (!member) throw new InviteError("That member is no longer available or has already been claimed. Please choose another name.");
    await tx.orm.public.GuestSession.create({
      groupMemberId: member.id, tokenHash: hash, createdAt: timestamp,
      lastSeenAt: timestamp, expiresAt: expiresAt.toISOString(),
    });
    await tx.orm.public.ActivityEvent.create({
      groupId: group.id, memberId: member.id, eventType: "MEMBER_CLAIMED",
      description: `${member.name} joined the group`, entityType: "GROUP_MEMBER",
      entityId: member.id, createdAt: timestamp,
    });
  });
  return { token, expiresAt };
}
