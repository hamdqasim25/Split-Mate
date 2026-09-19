import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getGroupForOwner } from "@/data/groups";
import { getCurrentUser } from "@/lib/auth/session";
import ShareLink from "@/components/groups/share-link";

export const metadata: Metadata = {
  title: "Group details | SPLITMate",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/London",
});

const activityDateFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/London",
});

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const { groupId } = await params;

  // Accept only positive decimal IDs within the database's Int range.
  if (!/^[1-9]\d{0,9}$/.test(groupId)) {
    notFound();
  }

  const id = Number(groupId);

  if (id > 2_147_483_647) {
    notFound();
  }

  // Ownership is checked by the service using the verified session's User ID.
  const result = await getGroupForOwner(user.id, id);

  if (!result) {
    notFound();
  }

  const { group, members, activity } = result;

  return (
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-emerald-800 hover:text-emerald-950"
        >
          ← Back to dashboard
        </Link>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-800">
            Your group
          </p>

          <h1 className="mt-3 break-words text-4xl font-semibold tracking-tight sm:text-5xl">
            {group.name}
          </h1>

          {group.description && (
            <p className="mt-4 max-w-3xl whitespace-pre-wrap break-words text-lg leading-8 text-slate-600">
              {group.description}
            </p>
          )}

          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Currency</dt>
              <dd className="mt-1 font-semibold">{group.currency}</dd>
            </div>

            <div>
              <dt className="text-slate-500">Active members</dt>
              <dd className="mt-1 font-semibold">{members.length}</dd>
            </div>

            <div>
              <dt className="text-slate-500">Created</dt>
              <dd className="mt-1 font-semibold">
                <time dateTime={group.createdAt}>
                  {dateFormat.format(new Date(group.createdAt))}
                </time>
              </dd>
            </div>
          </dl>
        </header>

        <section aria-labelledby="members-heading" className="mt-12">
          <h2 id="members-heading" className="text-2xl font-semibold">
            Group members
          </h2>

          {members.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No active members.
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6"
                >
                  <h3 className="break-words text-lg font-semibold">
                    {member.name}
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    {member.role === "OWNER" ? "Owner" : "Member"} ·{" "}
                    {member.claimedAt ? "Claimed" : "Not yet claimed"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ShareLink
          shareToken={group.shareToken}
          shareLinkEnabled={group.shareLinkEnabled}
        />

        <section aria-labelledby="activity-heading" className="mt-12">
          <h2 id="activity-heading" className="text-2xl font-semibold">
            Recent activity
          </h2>

          {activity.length === 0 ? (
            <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
              No activity yet. Group updates will appear here.
            </p>
          ) : (
            <ul className="mt-5 rounded-2xl border border-slate-200 bg-white">
              {activity.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-col gap-3 border-b border-slate-100 p-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="min-w-0 break-words font-semibold">
                    {event.description}
                  </p>

                  <time
                    dateTime={event.createdAt}
                    className="shrink-0 text-sm text-slate-500"
                  >
                    {activityDateFormat.format(new Date(event.createdAt))}{" "}
                    (London)
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}