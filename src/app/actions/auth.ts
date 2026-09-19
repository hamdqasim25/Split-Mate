"use server";

import { redirect } from "next/navigation";
import { revokeUserSession } from "@/lib/auth/session";

export async function signOut() {
  await revokeUserSession();
  redirect("/");
}