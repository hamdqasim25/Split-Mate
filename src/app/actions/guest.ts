"use server";

import { redirect } from "next/navigation";
import { claimMember, findInviteGroup, InviteError } from "@/data/invites";
import { getGuestForGroup, revokeGuestSession, setGuestSessionCookie } from "@/lib/auth/guest-session";
import { isValidToken } from "@/lib/auth/tokens";

export async function claimGuest(shareToken: string, _previous: { error: string }, form: FormData) {
  try {
    const group = await findInviteGroup(shareToken);
    if (!group) throw new InviteError("This invite link is no longer active.");
    const existing = await getGuestForGroup(group.id);
    if (!existing) {
      if (!group.shareLinkEnabled) throw new InviteError("This invite link is no longer active.");
      const value = form.get("memberId");
      if (typeof value !== "string" || !/^[1-9]\d{0,9}$/u.test(value)) throw new InviteError("Choose an available member name.");
      const session = await claimMember(shareToken, Number(value));
      await setGuestSessionCookie(session);
    }
  } catch (error) {
    if (error instanceof InviteError) return { error: error.message };
    // Do not log driver errors: they can contain parameters or connection details.
    console.error("Guest claim failed unexpectedly.");
    return { error: "Unable to join the group. Please reload and try again." };
  }
  redirect(`/g/${shareToken}/group`);
}

export async function signOutGuest(shareToken: string) {
  try {
    await revokeGuestSession();
  } catch {
    console.error("Guest sign-out failed unexpectedly.");
    return { error: "Unable to sign out. Please try again." };
  }
  redirect(isValidToken(shareToken) ? `/g/${shareToken}` : "/g/invalid");
}
