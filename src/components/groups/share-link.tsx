"use client";

import { useState } from "react";

type ShareLinkProps = {
  shareToken: string;
  shareLinkEnabled: boolean;
};

export default function ShareLink({
  shareToken,
  shareLinkEnabled,
}: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const invitePath = `/g/${shareToken}`;

  async function copyInviteLink() {
    if (!shareLinkEnabled) {
      return;
    }

    const inviteUrl = `${window.location.origin}${invitePath}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Invite members</h2>

          <p className="mt-1 text-sm text-muted">
            Share this link with people who are already listed in the group.
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            shareLinkEnabled
              ? "bg-accent-soft text-accent"
              : "bg-subtle text-muted"
          }`}
        >
          {shareLinkEnabled ? "Sharing enabled" : "Sharing disabled"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface p-5">
        {shareLinkEnabled ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1 rounded-xl border border-line bg-subtle px-4 py-3">
                <p className="truncate font-mono text-sm text-muted">
                  {invitePath}
                </p>
              </div>

              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
              >
                {copied ? "Copied!" : "Copy invite link"}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-muted">
              Anyone with this link can choose an unclaimed member name and join
              without an account. Share it only with your group members.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            This group&apos;s invite link is currently disabled.
          </p>
        )}
      </div>
    </section>
  );
}
