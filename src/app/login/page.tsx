import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in | SPLITMate" };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; registered?: string | string[] }>;
}) {
  const params = await searchParams;
  const destination = params.next === "/groups/new" ? "/groups/new" : "/dashboard";
  if (await getCurrentUser()) redirect(destination);

  return <AuthForm mode="login" destination={destination} accountCreated={params.registered === "1"} />;
}
