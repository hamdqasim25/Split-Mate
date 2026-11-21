import { loginUser } from "@/data/auth";
import { authErrorResponse, authResponse, readAuthJson } from "@/lib/auth/http";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await loginUser(await readAuthJson(request), request.url);
    return authResponse({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
