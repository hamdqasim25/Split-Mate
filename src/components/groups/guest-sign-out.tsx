"use client";

import { useActionState } from "react";
import { signOutGuest } from "@/app/actions/guest";

export default function GuestSignOut({ shareToken }: { shareToken: string }) {
  const [state, action, pending] = useActionState(signOutGuest.bind(null, shareToken), { error: "" });
  return (
    <form action={action} className="mt-10 border-t border-line pt-6">
      <p id="guest-sign-out-help" className="max-w-xl text-sm text-muted">
        Signing out removes access on this device. Your name stays claimed and cannot be selected again. Session recovery is not available yet.
      </p>
      <button type="submit" disabled={pending} aria-describedby="guest-sign-out-help"
        className="mt-4 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">
        {pending ? "Signing out…" : "Sign out on this device"}
      </button>
      {state.error && <p role="alert" className="mt-3 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
