import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { hasCurrentGuestSession } from "@/lib/auth/guest-session";

/** Presentation only: never use this classification to authorize mutations. */
export async function getVisitorState(): Promise<"owner" | "guest" | "signed-out"> {
  if (await getCurrentUser()) return "owner";
  return await hasCurrentGuestSession() ? "guest" : "signed-out";
}
