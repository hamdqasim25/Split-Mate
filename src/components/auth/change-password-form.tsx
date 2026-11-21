"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";

const guidance = "Use at least 15 characters and no more than 72 UTF-8 bytes.";
const uncertain = "The password change may have completed. Try signing in with your new password before trying again.";
export default function ChangePasswordForm() {
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");
    const confirmPassword = String(data.get("confirmPassword") ?? "");
    if ([...newPassword].length < 15 || new TextEncoder().encode(newPassword).length > 72) { setMessage(guidance); return; }
    if (newPassword !== confirmPassword) { setMessage("New passwords do not match."); return; }
    submitting.current = true; setPending(true); setMessage("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      if (response.ok) {
        form.reset(); setSuccess(true);
        setMessage("Password changed. Sign in with your new password.");
        // Refresh the document so revoked cookies cannot leave cached owner navigation visible.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login?passwordChanged=1");
      } else if (response.status === 401) { form.reset(); setMessage("Please sign in again."); }
      else if (response.status === 400) {
        const result = await response.json();
        const allowed = ["Current password is incorrect.", "New passwords do not match.", "Use a password of at least 15 characters and no more than 72 UTF-8 bytes."];
        setMessage(allowed.includes(result?.error?.message) ? result.error.message : "Check your password details and try again.");
      } else { form.reset(); setMessage(uncertain); }
    } catch { form.reset(); setMessage(uncertain); }
    finally { submitting.current = false; setPending(false); }
  }
  return <form onSubmit={submit} method="post" action="/api/auth/change-password" className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-6" aria-busy={pending}>
    <fieldset disabled={pending || success} className="space-y-5 disabled:opacity-70">
      <legend className="sr-only">Change your password</legend>
      {([ ["currentPassword", "Current password", "current-password"], ["newPassword", "New password", "new-password"], ["confirmPassword", "Confirm new password", "new-password"] ] as const).map(([name, label, autocomplete]) => <div key={name}>
        <label htmlFor={name} className="text-sm font-semibold">{label}</label>
        <input id={name} name={name} type="password" autoComplete={autocomplete} required aria-describedby={[name === "newPassword" ? "password-guidance" : "", message ? "password-feedback" : ""].filter(Boolean).join(" ") || undefined} className="mt-2 min-h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-4 py-3 focus-visible:outline-2 focus-visible:outline-accent" />
      </div>)}
      <p id="password-guidance" className="text-sm text-muted">{guidance} Passwords are not trimmed or changed.</p>
      <button type="submit" className="min-h-11 w-full cursor-pointer rounded-full bg-emerald-800 px-6 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-wait" disabled={pending || success}>{pending ? "Changing password..." : "Change password"}</button>
    </fieldset>
    <p role="status" className="sr-only">{pending ? "Changing password. Please wait." : ""}</p>
    <p id="password-feedback" role={success ? "status" : "alert"} aria-atomic="true" className={message ? `mt-4 rounded-xl p-3 text-sm ${success ? "bg-accent-soft text-accent" : "bg-danger-soft text-danger"}` : undefined}>{message}</p>
    {message && <Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-accent underline">Sign in</Link>}
  </form>;
}
