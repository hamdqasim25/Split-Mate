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

          <p className="mt-1 text-sm text-slate-500">
            Share this link with people who are already listed in the group.
          </p>
        </div>

        <span
          className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold ${
            shareLinkEnabled
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {shareLinkEnabled ? "Sharing enabled" : "Sharing disabled"}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        {shareLinkEnabled ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="truncate font-mono text-sm text-slate-700">
                  {invitePath}
                </p>
              </div>

              <button
                type="button"
                onClick={copyInviteLink}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
              >
                {copied ? "Copied!" : "Copy invite link"}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Anyone with this link can reach the group&apos;s guest entry page
              once guest access is enabled.
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            This group&apos;s invite link is currently disabled.
          </p>
        )}
      </div>
    </section>
  );
}