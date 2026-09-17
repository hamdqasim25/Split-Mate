import { registerUser } from "@/data/auth";
import { authErrorResponse, authResponse, readAuthJson } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await registerUser(await readAuthJson(request));
    // Registration creates an account only; login explicitly establishes a session.
    return authResponse({ user }, 201);
  } catch (error) {
    return authErrorResponse(error);
  }
}
