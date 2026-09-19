"use client";

import { useActionState } from "react";
import { claimGuest } from "@/app/actions/guest";

export default function ClaimMemberForm({ shareToken, members }: {
  shareToken: string; members: readonly { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(claimGuest.bind(null, shareToken), { error: "" });
  return (
    <form action={action} className="mt-6">
      <fieldset disabled={pending} className="space-y-3">
        <legend className="mb-3 text-sm text-slate-600">Choose only your own name. No account needed.</legend>
        {members.map((member) => (
          <button key={member.id} name="memberId" value={member.id} type="submit"
            className="block w-full break-words rounded-xl bg-emerald-800 px-5 py-4 text-left font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">
            Continue as {member.name}
          </button>
        ))}
      </fieldset>
      {pending && <p role="status" className="mt-4 text-sm text-slate-600">Joining the group…</p>}
      {state.error && <p role="alert" className="mt-4 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
