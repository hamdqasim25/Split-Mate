"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

/** Server-classified navigation only; privileged actions still authorize on the server. */
export default function AccountMenu({ visitor }: { visitor: "owner" | "guest" | "signed-out" }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: Event) => {
      const element = disclosure.current;
      if (element && event.target instanceof Node && !element.contains(event.target)) element.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      const element = disclosure.current;
      if (event.key === "Escape" && element?.open) {
        element.open = false;
        element.querySelector("summary")?.focus();
        event.preventDefault();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("focusin", closeOutside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("focusin", closeOutside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const close = () => { if (disclosure.current) disclosure.current.open = false; };
  const item = "flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-subtle focus-visible:outline-2 focus-visible:outline-accent";
  return (
    <details ref={disclosure} className="relative">
      <summary aria-label="Account navigation" className="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-1 rounded-full border border-line bg-surface px-2 text-foreground hover:bg-subtle active:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m3 4.5 3 3 3-3" /></svg>
      </summary>
      <nav aria-label="Account" className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-2 text-foreground shadow-lg">
        <p className="px-3 py-2 text-xs font-semibold text-muted">Account</p>
        {visitor === "owner" ? <>
        <Link href="/profile" onClick={close} className={item}>Profile</Link>
        <Link href="/profile/appearance" onClick={close} className={item}>Appearance</Link>
        <form action={signOut} className="mt-2 border-t border-line pt-2">
          <button type="submit" className={`${item} w-full cursor-pointer`}>Sign out</button>
        </form>
        </> : (visitor === "guest" ? ["Register", "Log in"] : ["Log in", "Register"]).map((label, index) => (
          <Link key={label} href={label === "Register" ? "/register" : "/login"} onClick={close} className={`${item} ${index === 0 ? "bg-accent-soft text-accent" : ""}`}>{label}</Link>
        ))}
      </nav>
    </details>
  );
}
