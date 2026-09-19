"use client";

import { useActionState } from "react";
import { signOutGuest } from "@/app/actions/guest";

export default function GuestSignOut({ shareToken }: { shareToken: string }) {
  const [state, action, pending] = useActionState(signOutGuest.bind(null, shareToken), { error: "" });
  return (
    <form action={action} className="mt-10 border-t border-slate-200 pt-6">
      <p id="guest-sign-out-help" className="max-w-xl text-sm text-slate-600">
        Signing out removes access on this device. Your name stays claimed and cannot be selected again. Session recovery is not available yet.
      </p>
      <button type="submit" disabled={pending} aria-describedby="guest-sign-out-help"
        className="mt-4 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60">
        {pending ? "Signing out…" : "Sign out on this device"}
      </button>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
