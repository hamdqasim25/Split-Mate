"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

type Props = {
  mode: "login" | "register";
  destination: "/dashboard" | "/groups/new";
  accountCreated?: boolean;
};

const inputStyle = "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const passwordGuidance = "Use at least 15 characters and no more than 72 UTF-8 bytes. Some characters use more than one byte.";

export default function AuthForm({ mode, destination, accountCreated = false }: Props) {
  const registering = mode === "register";
  const safeDestination = destination === "/groups/new" ? "/groups/new" : "/dashboard";
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // The ref also blocks a second submit before React has rendered the pending state.
  const submitting = useRef(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim().replace(/\s+/gu, " ");
    setError("");

    if (registering && (name.length === 0 || name.length > 100)) {
      setError("Enter a name between 1 and 100 characters.");
      return;
    }
    if (registering && ([...password].length < 15 || new TextEncoder().encode(password).length > 72)) {
      setError(passwordGuidance);
      return;
    }

    submitting.current = true;
    setPending(true);
    let navigating = false;
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(registering ? { name, email, password } : { email, password }),
      });
      if (!response.ok) {
        // Fixed messages keep internal errors and account details out of the UI.
        if (!registering && response.status === 401) setError("Email or password is incorrect.");
        else if (registering && response.status === 409) setError("Unable to register with those details. If you already have an account, try logging in.");
        else if (response.status === 400) setError("Check your details and try again.");
        else setError("Unable to complete your request. Please try again.");
        return;
      }
      // Full navigation ensures protected Server Components read the new cookie.
      window.location.assign(registering
        ? `/login?registered=1&next=${encodeURIComponent(safeDestination)}`
        : safeDestination);
      navigating = true;
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      if (!navigating) {
        submitting.current = false;
        setPending(false);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#f8faf7] px-6 py-12 font-sans text-slate-900 sm:py-20">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-xl font-bold tracking-tight">SPLIT<span className="text-emerald-800">Mate</span></Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight">{registering ? "Create account" : "Log in"}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{registering ? "Create an owner account to organise your groups. Guest members do not need an account." : "Welcome back. Log in to manage your groups."}</p>
        {accountCreated && !registering && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Account created. Log in to continue.</p>}
        <form onSubmit={handleSubmit} method="post" action={`/api/auth/${mode}`} aria-busy={pending} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
            <legend className="sr-only">{registering ? "Create an owner account" : "Owner login"}</legend>
            {registering && <div>
              <label htmlFor="name" className="text-sm font-semibold">Name</label>
              <input id="name" name="name" autoComplete="name" required maxLength={100} className={inputStyle} />
            </div>}
            <div>
              <label htmlFor="email" className="text-sm font-semibold">Email address</label>
              <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} className={inputStyle} />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-semibold">Password</label>
              <input id="password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required aria-describedby={registering ? "password-guidance" : undefined} className={inputStyle} />
              {registering && <p id="password-guidance" className="mt-2 text-xs leading-5 text-slate-500">{passwordGuidance}</p>}
            </div>
            <button type="submit" disabled={pending} className="w-full rounded-full bg-emerald-800 px-6 py-3.5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 disabled:cursor-wait">
              {pending ? (registering ? "Creating account…" : "Logging in…") : (registering ? "Create account" : "Log in")}
            </button>
          </fieldset>
          <p role="status" className="sr-only">{pending ? "Please wait." : ""}</p>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        </form>
        <p className="mt-6 text-sm text-slate-600">
          {registering ? "Already have an account? " : "New to SPLITMate? "}
          <Link href={`/${registering ? "login" : "register"}?next=${encodeURIComponent(safeDestination)}`} className="font-semibold text-emerald-800 hover:underline">{registering ? "Log in" : "Create account"}</Link>
        </p>
      </div>
    </main>
  );
}
