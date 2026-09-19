import { GroupCreationError, createGroup } from "@/data/groups";
import { AuthError } from "@/lib/auth/errors";
import {
  assertSameOrigin,
  authErrorResponse,
  authResponse,
} from "@/lib/auth/http";
import { requireUser } from "@/lib/auth/session";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;

async function readGroupJson(request: Request): Promise<unknown> {
  assertSameOrigin(request);

  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new AuthError(
      "UNSUPPORTED_MEDIA_TYPE",
      "Send group details as JSON.",
    );
  }

  const reader = request.body?.getReader();

  if (!reader) {
    throw new AuthError("INVALID_INPUT", "Provide group details.");
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      size += value.byteLength;

      if (size > MAX_BODY_BYTES) {
        await reader.cancel();

        throw new AuthError(
          "PAYLOAD_TOO_LARGE",
          "The group details are too large.",
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AuthError(
      "INVALID_INPUT",
      "Provide valid JSON group details.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const input = await readGroupJson(request);

    const group = await createGroup(user.id, input);

    return authResponse({ group }, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return authErrorResponse(error);
    }

    if (error instanceof GroupCreationError) {
      const status = error.code === "INVALID_INPUT" ? 400 : 401;

      return authResponse(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.field && { field: error.field }),
          },
        },
        status,
      );
    }

    console.error("Group creation request failed.");

    return authResponse(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to create the group. Please try again.",
        },
      },
      500,
    );
  }
}