import "server-only";

import { randomBytes } from "node:crypto";
import { db } from "@/prisma/db";

type GroupCreationErrorCode = "INVALID_INPUT" | "OWNER_NOT_FOUND";

export class GroupCreationError extends Error {
  readonly code: GroupCreationErrorCode;
  readonly field?: string;

  constructor(code: GroupCreationErrorCode, message: string, field?: string) {
    super(message);
    this.name = "GroupCreationError";
    this.code = code;
    this.field = field;
  }
}

type CreateGroupInput = {
  name: string;
  description: string | null;
  currency: "GBP";
  memberNames: string[];
};

function invalidInput(message: string, field?: string): never {
  throw new GroupCreationError("INVALID_INPUT", message, field);
}

function requiredName(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    invalidInput("Enter a name.", field);
  }

  const name = value.trim().replace(/\s+/gu, " ");
  if (name.length === 0 || name.length > maxLength) {
    invalidInput(`Enter a name between 1 and ${maxLength} characters.`, field);
  }

  return name;
}

function nameKey(name: string): string {
  return name.normalize("NFKC").toLowerCase();
}

function validateInput(input: unknown): CreateGroupInput {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    invalidInput("Provide group details.");
  }

  const values = input as Record<string, unknown>;
  const allowedFields = new Set(["name", "description", "currency", "memberNames"]);
  if (Object.keys(values).some((key) => !allowedFields.has(key))) {
    invalidInput("The group details contain an unsupported field.");
  }

  const name = requiredName(values.name, "name", 100);
  let description: string | null = null;
  if (values.description !== undefined && values.description !== null) {
    if (typeof values.description !== "string") {
      invalidInput("Enter a text description.", "description");
    }
    description = values.description.trim() || null;
    if (description !== null && description.length > 1000) {
      invalidInput("Keep the description to 1000 characters or fewer.", "description");
    }
  }

  if (values.currency !== "GBP") {
    invalidInput("Use GBP for the group currency.", "currency");
  }

  if (!Array.isArray(values.memberNames) || values.memberNames.length > 50) {
    invalidInput("Provide a list of up to 50 guest names.", "memberNames");
  }

  const memberNames: string[] = [];
  const seenNames = new Set<string>();
  for (const [index, value] of values.memberNames.entries()) {
    const field = `memberNames.${index}`;
    const memberName = requiredName(value, field, 100);
    const key = nameKey(memberName);
    if (seenNames.has(key)) {
      invalidInput("Use distinct member names; add an initial if needed.", field);
    }
    seenNames.add(key);
    memberNames.push(memberName);
  }

  return { name, description, currency: values.currency, memberNames };
}

/**
 * Internal service: authenticatedOwnerId must come from a verified server session.
 * Looking up a User here checks existence; it does not authenticate a caller.
 * Do not expose this function as a Server Action accepting a client-supplied ID.
 */
export async function createGroup(authenticatedOwnerId: number, input: unknown) {
  if (
    !Number.isInteger(authenticatedOwnerId) ||
    authenticatedOwnerId <= 0 ||
    authenticatedOwnerId > 2_147_483_647
  ) {
    throw new GroupCreationError("OWNER_NOT_FOUND", "The owner account is unavailable.");
  }

  const details = validateInput(input);

  return db.transaction(async (tx) => {
    // Select only identity fields: password hashes must never leave this layer.
    const owner = await tx.orm.public.User.select("id", "name").first({ id: authenticatedOwnerId });
    if (!owner) {
      throw new GroupCreationError("OWNER_NOT_FOUND", "The owner account is unavailable.");
    }

    const ownerName = requiredName(owner.name, "ownerName", 100);
    if (details.memberNames.some((name) => nameKey(name) === nameKey(ownerName))) {
      invalidInput("The owner is added automatically. Use distinct guest names.", "memberNames");
    }

    const createdAt = new Date().toISOString();
    // 256 bits of entropy. The existing unique constraint also prevents collisions.
    // A collision throws and rolls back; never retry unrelated database failures.
    const shareToken = randomBytes(32).toString("base64url");
    const group = await tx.orm.public.Group
      .select("id", "name", "description", "currency", "createdAt")
      .create({
        name: details.name,
        description: details.description,
        currency: details.currency,
        createdBy: owner.id,
        shareToken,
        shareLinkEnabled: true,
        createdAt,
      });

    const ownerMember = await tx.orm.public.GroupMember.create({
      groupId: group.id,
      userId: owner.id,
      name: ownerName,
      role: "OWNER",
      claimedAt: createdAt,
      lastActiveAt: createdAt,
      isActive: true,
      addedAt: createdAt,
    });

    for (const name of details.memberNames) {
      await tx.orm.public.GroupMember.create({
        groupId: group.id,
        userId: null,
        name,
        role: "MEMBER",
        claimedAt: null,
        lastActiveAt: null,
        isActive: true,
        addedAt: createdAt,
      });
    }

    await tx.orm.public.ActivityEvent.create({
      groupId: group.id,
      memberId: ownerMember.id,
      eventType: "GROUP_CREATED",
      description: `${ownerName} created the group`,
      entityType: "GROUP",
      entityId: group.id,
      createdAt,
    });

    return group;
  });
}
