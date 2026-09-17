import "server-only";

export type AuthErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "REGISTRATION_CONFLICT"
  | "FORBIDDEN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE";

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly field?: string;

  constructor(code: AuthErrorCode, message: string, field?: string) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.field = field;
  }
}
