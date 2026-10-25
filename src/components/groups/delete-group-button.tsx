"use client";

import { useActionState, useRef } from "react";
import { deleteGroupAction } from "@/app/actions/group-deletion";

export default function DeleteGroupButton({ groupId, groupName }: { groupId: number; groupName: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const [state, action, pending] = useActionState(async (previous: { error?: string }, form: FormData) => {
    try { return await deleteGroupAction(groupId, previous, form); }
    finally { submitting.current = false; }
  }, { error: "" });

  return (
    <>
      <button ref={trigger} type="button" aria-label={`Delete ${groupName}`} title="Delete group"
        onClick={() => { dialog.current?.showModal(); cancel.current?.focus(); }}
        className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-danger hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />
        </svg>
      </button>
      <dialog ref={dialog} aria-labelledby="delete-group-title" aria-describedby="delete-group-description"
        onCancel={event => { if (pending || submitting.current) event.preventDefault(); }}
        onClose={() => trigger.current?.focus()}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-foreground shadow-xl backdrop:bg-black/60">
        <h2 id="delete-group-title" className="break-words text-xl font-semibold">Delete {groupName}?</h2>
        <p id="delete-group-description" className="mt-3 text-sm leading-6 text-muted">This will permanently remove this group, all its expenses, repayments, activity history and member access. Shared links and guest sessions will stop working. This cannot be undone.</p>
        <form action={action} aria-busy={pending} onSubmit={event => {
          if (pending || submitting.current) { event.preventDefault(); return; }
          submitting.current = true;
        }}>
          <input type="hidden" name="confirmed" value="yes" />
          {state.error && <p role="alert" className="mt-4 rounded-xl bg-danger-soft p-3 text-sm text-danger">{state.error}</p>}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button ref={cancel} type="button" disabled={pending} onClick={() => { if (!submitting.current) dialog.current?.close(); }}
              className="min-h-11 rounded-xl border border-line px-4 py-2 font-semibold hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">Cancel</button>
            <button type="submit" disabled={pending}
              className="min-h-11 rounded-xl bg-danger px-4 py-2 font-semibold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60">{pending ? "Deleting…" : "Delete"}</button>
          </div>
          {pending && <p role="status" className="mt-3 text-sm text-muted">Deleting group. Please wait.</p>}
        </form>
      </dialog>
    </>
  );
}
