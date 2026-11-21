import { changePassword } from "@/data/password-change";
import { readAuthJson, authResponse, authErrorResponse } from "@/lib/auth/http";

export const runtime = "nodejs";
export async function POST(request: Request): Promise<Response> {
  try {
    await changePassword(await readAuthJson(request));
    return authResponse({ message: "Password changed. Sign in with your new password." });
  } catch (error) { return authErrorResponse(error); }
}
