import "server-only";
import { AuthError } from "@/lib/auth/errors";

export const BCRYPT_COST = 12;

export function passwordInput(value: unknown, registering: boolean): string {
  // Never trim or normalize passwords. bcrypt's upper bound is UTF-8 BYTES.
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") === 0 ||
    Buffer.byteLength(value, "utf8") > 72 ||
    (registering && [...value].length < 15)
  ) {
    throw new AuthError(
      "INVALID_INPUT",
      "Use a password of at least 15 characters and no more than 72 UTF-8 bytes.",
      "password",
    );
  }
  return value;
}

