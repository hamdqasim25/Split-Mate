import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function isValidToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(token)) return false;
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === token;
}

export function tokenHash(token: string | undefined): string | null {
  return isValidToken(token) ? createHash("sha256").update(token, "utf8").digest("hex") : null;
}

export function createSessionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token, "utf8").digest("hex") };
}
