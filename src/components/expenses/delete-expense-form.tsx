"use client";

import { useActionState } from "react";

export default function DeleteExpenseForm({ action }: {
  action: (previous: { error?: string }, form: FormData) => Promise<{ error?: string }>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="mt-5 space-y-4">
    {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    <button name="confirmed" value="yes" disabled={pending} className="min-h-11 rounded-xl border border-danger bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50">{pending ? "Deleting…" : "Confirm deletion"}</button>
    <p role="status" className="text-sm text-muted">{pending ? "Removing expense…" : ""}</p>
  </form>;
}
