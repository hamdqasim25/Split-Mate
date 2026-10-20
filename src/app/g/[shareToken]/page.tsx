import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { findInviteGroup, resolveInvite } from "@/data/invites";
import { getGuestForGroup } from "@/lib/auth/guest-session";
import ClaimMemberForm from "@/components/groups/claim-member-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Join a group | SPLITMate", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function InvitePage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  const group = await findInviteGroup(shareToken);
  if (group && await getGuestForGroup(group.id)) redirect(`/g/${shareToken}/group`);
  const invite = await resolveInvite(shareToken);
  return (
    <main className="min-h-screen bg-canvas px-6 py-12 font-sans text-foreground sm:py-20">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="font-semibold text-accent">SPLITMate</Link>
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          {invite.status !== "valid" ? <>
            <h1 className="text-2xl font-semibold">Invite unavailable</h1>
            <p className="mt-4 text-muted">{invite.status === "disabled" ? "This invite link is no longer active." : "This invite link is invalid or unavailable."} Ask the group owner for help.</p>
          </> : <>
            <h1 className="break-words text-3xl font-semibold">{invite.group.name}</h1>
            <p className="mt-4 text-muted">Choose your name to join this group.</p>
            {invite.members.length > 0 ? <ClaimMemberForm shareToken={shareToken} members={invite.members} /> :
              <p className="mt-6 text-muted">There are currently no unclaimed member identities available. Ask the group owner for help.</p>}
          </>}
        </section>
      </div>
    </main>
  );
}
