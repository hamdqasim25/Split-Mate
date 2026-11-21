import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";
import { BCRYPT_COST, passwordInput } from "@/lib/auth/password";
import { lockAccount } from "@/lib/auth/account-lock";
import { getCurrentUser, clearOwnerSessionCookies } from "@/lib/auth/session";

function signInAgain(): never {
  throw new AuthError("UNAUTHENTICATED", "Please sign in again.");
}

export async function changePassword(input: unknown): Promise<void> {
  const user = await getCurrentUser();
  if (!user) signInAgain();
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    Object.keys(input).some(key => !["currentPassword", "newPassword", "confirmPassword"].includes(key))) {
    throw new AuthError("INVALID_INPUT", "Provide only the required password fields.");
  }
  const values = input as Record<string, unknown>;
  let current: string;
  try { current = passwordInput(values.currentPassword, false); }
  catch { throw new AuthError("INVALID_INPUT", "Current password is incorrect.", "currentPassword"); }
  const next = passwordInput(values.newPassword, true);
  if (values.confirmPassword !== next) throw new AuthError("INVALID_INPUT", "New passwords do not match.", "confirmPassword");
  const observed = await db.orm.public.User.select("passwordHash").first({ id: user.id });
  if (!observed) signInAgain();
  if (!await bcrypt.compare(current, observed.passwordHash)) {
    throw new AuthError("INVALID_INPUT", "Current password is incorrect.", "currentPassword");
  }
  // CPU-expensive work is outside the lock; the exact observed hash is checked below.
  const passwordHash = await bcrypt.hash(next, BCRYPT_COST);
  await db.transaction(async tx => {
    const account = await lockAccount(tx, user.id);
    const authenticated = await getCurrentUser(tx);
    if (!account || authenticated?.id !== user.id || account.passwordHash !== observed.passwordHash) signInAgain();
    await tx.orm.public.User.where({ id: user.id }).select("id").updateAll({ passwordHash });
    await tx.orm.public.UserSession.where({ userId: user.id }).deleteAll();
  });
  await clearOwnerSessionCookies();
}
