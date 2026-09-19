# Authenticated Group Creation and Dashboard Reads

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed - creation flow

`/groups/new` is protected server-side. Its client form submits JSON to `POST /api/groups`, then navigates to `/dashboard` after success. The route calls `requireUser()` and passes the verified `user.id` to `createGroup(authenticatedOwnerId, input)`. Owner IDs are never accepted from the request body.

The route enforces same-origin requests, JSON content type and a 16 KiB body limit, returning safe errors and a 201 group summary on success. The server-only creation service uses the existing Prisma 8 RC `tx.orm.public` API.

```ts
{
  name: "Friday Football",
  description: "Weekly games", // optional service/API field
  currency: "GBP",
  memberNames: ["Ismaeel", "Jaher"]
}
```

Names are trimmed, whitespace collapsed and limited to 1-100 characters. Descriptions are limited to 1000 characters. The service supports 0-50 guest names; the owner is added automatically. Blank or duplicate names, including the owner's name, are rejected using NFKC normalization and `toLowerCase()` (not full Unicode case folding). Unknown fields, such as owner IDs, roles and tokens, are rejected.

One transaction loads the owner's stored name and creates:

1. Group, with a unique reusable token generated using `randomBytes(32)` and base64url encoding.
2. Owner GroupMember, linked to User, role OWNER and claimed timestamp.
3. Guest GroupMembers, role MEMBER, null userId and claimedAt.
4. GROUP_CREATED ActivityEvent, attributed to the owner's GroupMember.

Failures propagate so the transaction can roll back. The response selects only id, name, description, currency and createdAt; it never includes shareToken or account secrets. Pending UI prevents ordinary repeated clicks, but the service is not idempotent: separate successful requests can still create separate groups.

### Completed - dashboard reads

`getGroupsForOwner(user.id)` validates a positive integer within the database Int range. It selects owned groups newest first and uses a filtered relation count:

```ts
.include("members", (members) => members.where({ isActive: true }).count())
```

A second query selects the latest five ActivityEvents whose groupId is in the owned group IDs. Both queries use timestamp and ID descending for deterministic ordering. No groups means no activity query. No N+1 loop or share-token projection is used.

The page shows the verified owner name, group details, currency, active member counts, dates and event descriptions. Empty groups/activity states are explicit. Balance cards show neutral placeholders. The invalid `/groups` link was removed; dashboard cards do not yet navigate to group details.

### Verification

The 32 creation tests and 18 dashboard tests use database doubles. Auth suites add 70 tests. Targeted lint, TypeScript and production build passed. Live group creation successfully persisted the group, owner, guests and owner-attributed event in Prisma cloud PostgreSQL. A later read-only query confirmed one persisted group with four active members and one event, without returning the share token. Live rollback failure injection was not performed.

### Next

Owner group detail page, clickable dashboard cards, members/activity view, share-link controls, public token route, then guest claiming and GuestSession. See [roadmap](dev-roadmap.md).

### Future

Expenses, balances and repayments follow guest access. Add rate limiting before public deployment; evaluate server-side idempotency separately.

---

<details>
<summary>Historical original notes - not current implementation</summary>

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

</details>
