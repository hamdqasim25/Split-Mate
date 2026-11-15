import "server-only";

import { createHash, randomBytes } from "node:crypto";

/** Accept only the canonical base64url encoding of 32 bytes, without padding. */
export function isValidToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === token;
}

/** Convert a valid browser credential to its database lookup hash; invalid input returns null. */
export function tokenHash(token: string | undefined): string | null {
  return isValidToken(token) ? createHash("sha256").update(token, "utf8").digest("hex") : null;
}

/** Generate a fresh random credential and its storage hash.
 * Keep the raw token server-side until issuing its HttpOnly cookie; persist only the hash. */
export function createSessionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token, "utf8").digest("hex") };
}
