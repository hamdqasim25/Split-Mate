import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";

const SECURE_COOKIE = "__Host-splitmate_owner_session";
const LOCAL_COOKIE = "splitmate_owner_session";
const SESSION_SECONDS = 8 * 60 * 60;

function cookieNames(): string[] {
  return process.env.NODE_ENV === "production" ? [SECURE_COOKIE] : [SECURE_COOKIE, LOCAL_COOKIE];
}

function tokenHash(token: string | undefined): string | null {
  if (!token || !/^[A-Za-z0-9_-]{43}$/u.test(token)) return null;
  const bytes = Buffer.from(token, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== token) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function cookieOptions(name: string) {
  return {
    httpOnly: true,
    secure: name === SECURE_COOKIE,
    sameSite: "lax" as const,
    path: "/",
    // Intentionally no Domain: both cookies are host-only.
  };
}

/** Internal: call only after credentials have been verified server-side. */
export async function createUserSession(userId: number, requestUrl: string): Promise<void> {
  if (!Number.isInteger(userId) || userId <= 0 || userId > 2_147_483_647) {
    throw new AuthError("UNAUTHENTICATED", "Authentication is required.");
  }
  const secure = process.env.NODE_ENV === "production" || new URL(requestUrl).protocol === "https:";
  const cookieName = secure ? SECURE_COOKIE : LOCAL_COOKIE;
  const cookieStore = await cookies();
  const previousHashes = cookieNames()
    .map((name) => tokenHash(cookieStore.get(name)?.value))
    .filter((hash): hash is string => hash !== null);
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token, "utf8").digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);

  await db.transaction(async (tx) => {
    for (const previousHash of previousHashes) {
      await tx.orm.public.UserSession.where({ tokenHash: previousHash }).delete();
    }
    await tx.orm.public.UserSession.create({ userId, tokenHash: hash, expiresAt: expiresAt.toISOString() });
  });

  // Database success precedes cookie issuance. Never expose the token in JSON.
  cookieStore.set(cookieName, token, { ...cookieOptions(cookieName), maxAge: SESSION_SECONDS, expires: expiresAt });
  for (const name of cookieNames()) {
    if (name !== cookieName && cookieStore.get(name)) {
      cookieStore.set(name, "", { ...cookieOptions(name), maxAge: 0, expires: new Date(0) });
    }
  }
}

/** Resolves only owner sessions; GuestSession cookies are never consulted. */
export async function getCurrentUser(): Promise<{ id: number; name: string } | null> {
  const cookieStore = await cookies();
  // Prefer the HTTPS cookie; a malformed secure cookie must not trigger fallback.
  const sessionCookie = cookieNames().map((name) => cookieStore.get(name)).find(Boolean);
  const hash = tokenHash(sessionCookie?.value);
  if (!hash) return null;

  const session = await db.orm.public.UserSession
    .select("userId", "expiresAt")
    .first({ tokenHash: hash });
  if (!session) return null;
  const expiry = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;

  // Read-only: safe to call in Server Components. No shared cross-request cache.
  return db.orm.public.User.select("id", "name").first({ id: session.userId });
}

export async function requireUser(): Promise<{ id: number; name: string }> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Authentication is required.");
  return user;
}

export async function revokeUserSession(): Promise<void> {
  const cookieStore = await cookies();
  const names = cookieNames();
  const hashes = names
    .map((name) => tokenHash(cookieStore.get(name)?.value))
    .filter((hash): hash is string => hash !== null);

  if (hashes.length > 0) {
    await db.transaction(async (tx) => {
      for (const hash of hashes) {
        await tx.orm.public.UserSession.where({ tokenHash: hash }).delete();
      }
    });
  }
  // Never clear the browser's session before successful database revocation.
  for (const name of names) {
    cookieStore.set(name, "", { ...cookieOptions(name), maxAge: 0, expires: new Date(0) });
  }
}
