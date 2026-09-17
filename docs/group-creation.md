# Group creation backend

## Implementation and testing notes — 17 September 2026

This document was created during backend implementation and testing. The original service notes are retained separately below; this dated update records the verification and integration status.

The implemented service uses the existing Prisma client and namespace-qualified `tx.orm.public` access. It performs all required writes within one transaction and exposes no HTTP endpoint. A future authenticated handler must obtain the owner ID from a verified session before calling it.

All 32 unit tests, the TypeScript check, targeted lint and the application production build passed during implementation. Repository-wide lint reports existing generated/tooling findings. See the [progress report](progress-report.md) for exact checks and their scope.

The unit tests use a database double and do not verify live PostgreSQL rollback. Public submission, authentication, request deduplication, guest access and form/dashboard integration remain pending. The existing contract and migration history were unchanged.

The original notes use the phrase "case folding" for duplicate-name matching. More precisely, the implementation applies Unicode NFKC normalization followed by JavaScript `toLowerCase()`; it does not implement full Unicode case folding.

---

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


`src/data/groups.ts` implements the server-only `createGroup(authenticatedOwnerId, input)` service using the existing Prisma 8 client and contract.

The caller must obtain `authenticatedOwnerId` from a verified server session. An existing User ID alone is not authentication. Owner authentication and a public route/server action are not implemented yet, so the service is deliberately not exposed over HTTP. The current form and dashboard remain presentation only.

## Input

```ts
{
  name: "Friday Football",
  description: "Weekly games", // optional; blank becomes null
  currency: "GBP",
  memberNames: ["Ismaeel", "Jaher"]
}
```

- Group and member names are trimmed, repeated whitespace is collapsed, and names must contain 1–100 characters.
- Descriptions are limited to 1000 characters after trimming.
- GBP is the supported currency for this initial slice.
- Supply 0–50 guest names. The owner is added automatically, so an empty guest list creates a group containing only the owner.
- Blank guest names are rejected. Duplicate names are rejected after Unicode compatibility normalization and case folding via `toLowerCase`, including names matching the owner. Use distinguishable names such as initials for people with the same name.
- Unknown fields are rejected, including client-supplied owner IDs, roles and share tokens.

## Persistence and errors

One `db.transaction` loads the owner's identity and creates the Group, owner GroupMember, guest GroupMembers, and GROUP_CREATED ActivityEvent. All writes use `tx.orm.public`, matching this contract's namespace; a thrown error rolls back the transaction. The owner's display name comes from the User record. Guest members have null `userId` and `claimedAt`.

The service generates the share token with Node's `randomBytes(32)` and base64url encoding. The database's existing unique constraint prevents token collisions; a collision fails atomically. The returned group summary contains only `id`, `name`, `description`, `currency` and `createdAt`. Share tokens and password hashes are not returned or logged.

Expected errors use `GroupCreationError` with `INVALID_INPUT` or `OWNER_NOT_FOUND`, a safe message and an optional field. Unexpected database errors propagate so the transaction rolls back. A future authenticated HTTP boundary must translate errors into safe responses and must not return raw database errors.

The service is not idempotent: two successful calls create two groups. Before wiring a public submission flow, add request deduplication and request-origin protection alongside authentication. Group names are not unique and must not be used as idempotency keys.

## Verification

Run `node --test tests/create-group.test.mjs` with Node 24, `npm run lint`, and `npx --no-install tsc --noEmit --incremental false`.

The unit tests replace the database import with an in-memory transaction double. They check validation, identity assignment, the activity actor, token generation, and failure propagation through the transaction boundary. They do not connect to PostgreSQL or prove database-level rollback; that requires a separate integration test against a designated test database.
