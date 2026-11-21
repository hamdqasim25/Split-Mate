import "server-only";

import bcrypt from "bcryptjs";
import { BCRYPT_COST, passwordInput } from "@/lib/auth/password";
import { createUserSession } from "@/lib/auth/session";
import { db } from "@/prisma/db";
import { AuthError } from "@/lib/auth/errors";

// Explicit work factor: 2^12 bcrypt rounds. Reassess with deployment benchmarks.
export { BCRYPT_COST } from "@/lib/auth/password";
// A non-account hash at the same cost keeps unknown-email logins doing bcrypt work.
const DUMMY_PASSWORD_HASH = "$2b$12$Iui2xemc8q8f4l4Z1SVE4OH6XqvZZuhV0zUU0b5mR.f7mvCZhyrzG";

function objectInput(input: unknown, allowed: string[]): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AuthError("INVALID_INPUT", "Provide account details.");
  }
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new AuthError("INVALID_INPUT", "The account details contain an unsupported field.");
  }
  return input as Record<string, unknown>;
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new AuthError("INVALID_INPUT", "Enter a valid email address.", "email");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new AuthError("INVALID_INPUT", "Enter a valid email address.", "email");
  }
  return email;
}

function isUniqueViolation(error: unknown): boolean {
  // Prisma's SQL driver exposes sqlState; wrappers may retain it as a cause.
  let current = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("sqlState" in current && current.sqlState === "23505") return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}

function registrationConflict(): never {
  throw new AuthError("REGISTRATION_CONFLICT", "Unable to register with those details.");
}

/**
 * Validate owner registration and store a bcrypt hash, returning only ID/name.
 * A unique-email conflict is mapped to a safe error, including competing inserts.
 * Registration does not create a session; the login route does that separately.
 */
export async function registerUser(input: unknown) {
  const values = objectInput(input, ["name", "email", "password"]);
  const name = typeof values.name === "string" ? values.name.trim().replace(/\s+/gu, " ") : "";
  if (name.length === 0 || name.length > 100) {
    throw new AuthError("INVALID_INPUT", "Enter a name between 1 and 100 characters.", "name");
  }
  const email = normalizedEmail(values.email);
  const password = passwordInput(values.password, true);
  const existing = await db.orm.public.User.select("id").first({ email });
  if (existing) registrationConflict();

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    return await db.orm.public.User.select("id", "name").create({ name, email, passwordHash });
  } catch (error) {
    // Also handle concurrent registrations; only map a confirmed email conflict.
    if (isUniqueViolation(error) && await db.orm.public.User.select("id").first({ email })) {
      registrationConflict();
    }
    throw error;
  }
}

/** Internal credential check retains the observed hash for serialized issuance.
 * Never return this result to a browser. Credential failures share one public error. */
async function verifyCredentials(input: unknown) {
  let email: string;
  let password: string;
  try {
    const values = objectInput(input, ["email", "password"]);
    email = normalizedEmail(values.email);
    password = passwordInput(values.password, false);
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const user = await db.orm.public.User.select("id", "name", "passwordHash").first({ email });
  const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !matches) {
    throw new AuthError("INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  return user;
}

/** Credential-only verification never establishes a session. */
export async function authenticateUser(input: unknown) {
  const user = await verifyCredentials(input);
  return { id: user.id, name: user.name };
}

/** Keep the verified hash server-side and recheck it under the session-issuance lock. */
export async function loginUser(input: unknown, requestUrl: string) {
  const user = await verifyCredentials(input);
  await createUserSession(user.id, requestUrl, user.passwordHash);
  return { id: user.id, name: user.name };
}
