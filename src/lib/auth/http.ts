import "server-only";

import { AuthError, type AuthErrorCode } from "@/lib/auth/errors";

const STATUS: Record<AuthErrorCode, number> = {
  INVALID_INPUT: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  REGISTRATION_CONFLICT: 409,
  FORBIDDEN: 403,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
};
const MAX_BODY_BYTES = 4096;

export function assertSameOrigin(request: Request): void {
  // Browser-only same-origin endpoints. Missing/null Origin fails closed.
  // Do not accept arbitrary X-Forwarded-Host/Origin values as trusted configuration.
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthError("FORBIDDEN", "This request is not allowed.");
  }
}

export async function readAuthJson(request: Request): Promise<unknown> {
  assertSameOrigin(request);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new AuthError("UNSUPPORTED_MEDIA_TYPE", "Send account details as JSON.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError("INVALID_INPUT", "Provide account details.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AuthError("PAYLOAD_TOO_LARGE", "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuthError("INVALID_INPUT", "Provide valid JSON account details.");
  }
}

export function authResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function authErrorResponse(error: unknown): Response {
  if (error instanceof AuthError) {
    return authResponse({ error: { code: error.code, message: error.message, ...(error.field && { field: error.field }) } }, STATUS[error.code]);
  }
  // Database/driver errors can contain credentials, tokens or SQL: never log them.
  console.error("Owner authentication request failed.");
  return authResponse({ error: { code: "INTERNAL_ERROR", message: "Unable to complete the request. Please try again." } }, 500);
}
