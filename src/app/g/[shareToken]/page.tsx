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
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="font-semibold text-emerald-800">SPLITMate</Link>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          {invite.status !== "valid" ? <>
            <h1 className="text-2xl font-semibold">Invite unavailable</h1>
            <p className="mt-4 text-slate-600">{invite.status === "disabled" ? "This invite link is no longer active." : "This invite link is invalid or unavailable."} Ask the group owner for help.</p>
          </> : <>
            <h1 className="break-words text-3xl font-semibold">{invite.group.name}</h1>
            <p className="mt-4 text-slate-600">Choose your name to join this group.</p>
            {invite.members.length > 0 ? <ClaimMemberForm shareToken={shareToken} members={invite.members} /> :
              <p className="mt-6 text-slate-600">There are currently no unclaimed member identities available. Ask the group owner for help.</p>}
          </>}
        </section>
      </div>
    </main>
  );
}
