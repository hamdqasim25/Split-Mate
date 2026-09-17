import { revokeUserSession } from "@/lib/auth/session";
import { assertSameOrigin, authErrorResponse } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    await revokeUserSession();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return authErrorResponse(error);
  }
}
