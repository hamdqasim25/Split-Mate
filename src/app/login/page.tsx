import { authDestination } from "@/lib/auth/redirect";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import AuthForm from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in | SPLITMate" };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ next?: string | string[]; registered?: string | string[]; passwordChanged?: string | string[] }>;
}) {
  const params = await searchParams;
  const destination = authDestination(params.next);
  if (await getCurrentUser()) redirect(destination);

  return <AuthForm mode="login" destination={destination} accountCreated={params.registered === "1"} passwordChanged={params.passwordChanged === "1"} />;
}
