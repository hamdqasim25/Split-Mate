import { redirect } from "next/navigation";
import { isValidToken } from "@/lib/auth/tokens";

// Compatibility for previously opened links. The destination authenticates the
// guest; this route never renders private group data.
export default async function JoinedPage({ params }: { params: Promise<{ shareToken: string }> }) {
  const { shareToken } = await params;
  redirect(isValidToken(shareToken) ? `/g/${shareToken}/group` : "/g/invalid");
}
