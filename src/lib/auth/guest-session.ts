import "server-only";

import { cookies } from "next/headers";
import { db } from "@/prisma/db";
import { tokenHash } from "@/lib/auth/tokens";

const SECURE_COOKIE = "__Host-splitmate_guest_session";
const LOCAL_COOKIE = "splitmate_guest_session";

function cookieNames() {
  return process.env.NODE_ENV === "production" ? [SECURE_COOKIE] : [SECURE_COOKIE, LOCAL_COOKIE];
}

/** Internal validated context. Never pass session details into a Client Component. */
export async function getGuestSessionForGroup(groupId: number, client: Pick<typeof db, "orm"> = db) {
  if (!Number.isInteger(groupId) || groupId <= 0 || groupId > 2_147_483_647) return null;
  const store = await cookies();
  const cookie = cookieNames().map((name) => store.get(name)).find(Boolean);
  const hash = tokenHash(cookie?.value);
  if (!hash) return null;
  const session = await client.orm.public.GuestSession.select("id", "groupMemberId", "expiresAt", "lastSeenAt").first({ tokenHash: hash });
  if (!session || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) return null;
  const member = await client.orm.public.GroupMember.select("id", "name", "claimedAt", "lastActiveAt")
    .first({ id: session.groupMemberId, groupId, isActive: true, userId: null, role: "MEMBER" });
  if (!member?.claimedAt) return null;
  if (!await client.orm.public.Group.select("id").first({ id: groupId })) return null;
  return { session, member, groupId };
}

/** Read-only and group-scoped; owner cookies never establish a guest identity. */
export async function getGuestForGroup(groupId: number) {
  const guest = await getGuestSessionForGroup(groupId);
  return guest ? { id: guest.member.id, name: guest.member.name } : null;
}

/** Internal: use inside the group-read transaction after successful validation and reads. */
export async function recordGuestActivity(
  guest: NonNullable<Awaited<ReturnType<typeof getGuestSessionForGroup>>>,
  client: Pick<typeof db, "orm">,
) {
  const now = new Date();
  const timestamp = now.toISOString();
  const cutoff = now.getTime() - 5 * 60 * 1000;
  const { session, member, groupId } = guest;
  const stale = (value: string | null) => value === null || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= cutoff;

  // Compare observed timestamps so concurrent requests cannot overwrite a newer
  // activity time. Keep eligibility in the UPDATE and never extend expiry.
  if (stale(session.lastSeenAt)) {
    await client.orm.public.GuestSession
      .where({ id: session.id, groupMemberId: member.id, lastSeenAt: session.lastSeenAt })
      .where((row) => row.expiresAt.gt(timestamp))
      .select("id").updateAll({ lastSeenAt: timestamp });
  }
  if (stale(member.lastActiveAt)) {
    await client.orm.public.GroupMember
      .where({ id: member.id, groupId, isActive: true, userId: null, role: "MEMBER", claimedAt: member.claimedAt, lastActiveAt: member.lastActiveAt })
      .select("id").updateAll({ lastActiveAt: timestamp });
  }
}

/** Revoke only tokens from this browser's guest cookies, never its owner session. */
export async function revokeGuestSession() {
  const store = await cookies();
  const names = cookieNames();
  const hashes = names.map((name) => tokenHash(store.get(name)?.value)).filter((hash): hash is string => hash !== null);
  if (hashes.length > 0) {
    await db.transaction(async (tx) => {
      for (const hash of hashes) await tx.orm.public.GuestSession.where({ tokenHash: hash }).delete();
    });
  }
  // Preserve the browser credential if revocation fails. No membership is changed.
  for (const name of names) {
    store.set(name, "", { httpOnly: true, secure: name === SECURE_COOKIE, sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
  }
}

/** Called only after the claim transaction commits. One current guest cookie per browser. */
export async function setGuestSessionCookie(session: { token: string; expiresAt: Date }) {
  const store = await cookies();
  const name = process.env.NODE_ENV === "production" ? SECURE_COOKIE : LOCAL_COOKIE;
  store.set(name, session.token, {
    httpOnly: true, secure: name === SECURE_COOKIE, sameSite: "lax", path: "/", expires: session.expiresAt,
  });
  for (const other of cookieNames()) {
    if (other !== name && store.get(other)) {
      store.set(other, "", { httpOnly: true, secure: other === SECURE_COOKIE, sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
    }
  }
}
