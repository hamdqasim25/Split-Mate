import { authenticateUser } from "@/data/auth";
import { createUserSession } from "@/lib/auth/session";
import { authErrorResponse, authResponse, readAuthJson } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await authenticateUser(await readAuthJson(request));
    await createUserSession(user.id, request.url);
    return authResponse({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
