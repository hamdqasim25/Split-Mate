# SPLITMate Architecture

## Runtime and identity

Next.js App Router hosts pages, route handlers, Server Actions and server-only data services. React and Tailwind provide the UI; `src/prisma/db.ts` connects the pinned Prisma 8 RC runtime to Prisma-hosted PostgreSQL. There is no separate FastAPI backend.

A User is an account; a GroupMember is an identity inside one group. Only owners require accounts. All financial relationships reference GroupMember, including guests with null userId.

## Authentication

| Concern | Owner | Guest |
| --- | --- | --- |
| Establish identity | bcrypt-verified login | Claim an eligible owner-defined member through an enabled invite |
| Session model | UserSession → User | GuestSession → GroupMember |
| Expiry | Eight hours | 30 days; activity does not extend expiry |
| Cookie | Owner-specific host-only HttpOnly cookie | Separate guest-specific host-only HttpOnly cookie |
| Access check | Verified owner ID and Group.createdBy | Valid session, active claimed MEMBER with null userId, matching group |
| Sign-out | Revoke browser owner sessions, clear owner cookies | Revoke browser guest sessions, clear guest cookies; preserve claimedAt |

Both session types use 32 random bytes and store only SHA-256 token hashes. Shared helpers validate canonical base64url tokens. Cookies use SameSite=Lax; production uses Secure and the `__Host-` prefix. Owner issuance also supports an HTTPS development cookie. Guest issuance uses the local cookie outside production.

Registration normalizes email and hashes passwords with bcrypt cost 12; passwords are not trimmed and require 15 characters minimum, 72 UTF-8 bytes maximum. Registration does not issue a session. HTTP mutation endpoints enforce same origin; Server Actions use Next.js's action request protection and revalidate identity/input server-side.

Session reads reject malformed, missing, expired or unusable credentials. Server Components do not mutate cookies during rendering. Explicit sign-out clears cookies only after successful revocation.

## Guest flow

```mermaid
flowchart TD
    Invite[Shared invite] --> Lookup[Resolve group token]
    Lookup --> Existing{Valid same-group guest session?}
    Existing -->|Yes| Group[Protected guest group page]
    Existing -->|No| Enabled{Sharing enabled?}
    Enabled -->|Yes| Names[Eligible member names]
    Names --> Claim[Transactional conditional claim]
    Claim --> Records[claimedAt + hashed GuestSession + MEMBER_CLAIMED]
    Records --> Cookie[Issue guest cookie]
    Cookie --> Group
    Enabled -->|No| Unavailable[Invite unavailable]
    Group --> Data[Current identity, active members, recent activity]
    Data --> Activity[Throttled activity timestamps]
```

Claim eligibility is active, unclaimed, role MEMBER and null userId, in the group resolved from the token. Conditional `updateAll()` writes retain guards in SQL: the group write coordinates claiming with link changes, and the member write prevents two successful claims. Session/event creation shares the transaction. This RC's single-row `update()` first resolves an ID, so it is not used for these guarded writes.

Sharing controls new invitations, not existing membership. Disabling sharing preserves valid guest access; inactive membership blocks it. Rotating a token would make old URLs unresolvable, including for existing guests. Rotation/disable UI is not implemented.

## Routing and data boundaries

| Route | Behaviour |
| --- | --- |
| `/` | Session-aware landing actions |
| `/register`, `/login` | Owner authentication; allowed return paths are dashboard/group creation |
| `/dashboard` | Owner's groups, active-member counts and latest five owned-group events |
| `/groups/new` | Owner-only creation form → POST /api/groups |
| `/groups/[groupId]` | Ownership checked server-side; active members, latest 10 events and share UI |
| `/groups/[groupId]/expenses/new` | Owner session and active OWNER GroupMember required; shared expense form |
| `/g/[shareToken]/expenses/new` | Matching active claimed guest session required; same shared expense form |
| `/g/[shareToken]` | Invite; existing same-group guests redirect to /group even when sharing is disabled |
| `/g/[shareToken]/group` | Matching guest session required; failures redirect to invite without private lists |
| `/g/[shareToken]/joined` | Compatibility redirect to the protected /group destination |

Successful claims go directly to the guest group page. Guest sign-out returns to the invite without making the identity claimable again. Invalid token paths use a fixed safe destination. Unexpected protected-group/action failures produce generic messages.

Guest output contains group/current-member identity, active member names/joined status, the latest 50 expenses and up to 10 events ordered by timestamp and ID descending. Allowed events are GROUP_CREATED, MEMBER_CLAIMED, MEMBER_ADDED, MEMBER_REMOVED and EXPENSE_CREATED. Other event types need an explicit visibility decision. Owner account data and authentication fields are excluded. Expense lists expose only description, amount, payer name, date, ID participant count, split method and participant IDs/names/amounts; inactive payers retain their historical display name.

Guest group reads and activity updates share a transaction. lastSeenAt and lastActiveAt each refresh when at least five minutes old; observed-value guards avoid overwriting newer timestamps. No page-view ActivityEvents are created. Guest pages are dynamic and set noindex/no-referrer metadata.

## Expense validation, review and persistence

`src/data/expenses.ts` provides a read-only `getExpenseFormContext` service. The owner route explicitly chooses owner authentication; the guest route chooses guest authentication. Having both cookies never silently switches identities. The service resolves credentials itself, checks ownership for owners and same-group membership for both flows, then loads active members in addedAt order with ID as a tie-breaker. Active unclaimed guests remain valid payer/participant options.

The client receives only the group name/currency, current member ID/name and active member IDs/names. Account IDs, session details, share tokens and activity fields are excluded. Disabled invitations preserve existing guest access, following the existing policy. No expense context reads write activity or financial records.

Both pages render `ExpenseForm`, with description, amount, a payer select defaulted to the current GroupMember and independent participant checkboxes. Route-bound Server Actions call `previewExpense` to calculate a review. The shared ExpenseReview shows description, total, payer and editable amounts beside participant names. BigInt totals show assigned and remaining amounts; save is disabled unless valid nonnegative shares match the total exactly. Reset to equal restores the server baseline. Participant display order follows the group member list, independently of remainder allocation. Back and edit preserves expense details and starts a new equal split; confirm and save calls `createExpense`, then redirects to the appropriate group page after commit. Pending buttons reduce accidental repeat clicks. Entries are not retained after leaving the page.

Validation trims descriptions (1–1000 characters), requires a positive GBP amount with at most two decimal places (£0.01–£999,999,999.99), and requires 1–51 distinct participants. Scientific notation, currency symbols, commas, duplicate IDs, malformed IDs, inactive members and foreign-group members are rejected. The payer may be outside the participant selection. Active unclaimed guests may pay or participate. Currency comes from the group; other currencies are rejected in this milestone.

`money.ts` converts decimal text to integer pence with BigInt arithmetic. Equal splitting sorts by ascending GroupMember ID, divides the pence total and gives one extra penny to the first remainder-count members. £10.00 across three members becomes £3.34/£3.33/£3.33, independent of selection order. Tiny totals may produce zero-pence shares (1p across three is 1p/0p/0p). Exact pound strings go to existing Decimal columns; no JavaScript floating-point pound arithmetic is used.

Save authenticates again and validates each proposed share: every selected participant must appear exactly once, no additional member is allowed, amounts must be nonnegative decimal strings with at most two places, and their integer-pence sum must equal the expense total. It persists these exact validated amounts. Actor IDs, redirect URLs and previous action state are not trusted. A failed save retains proposed values alongside a freshly authorized review where possible. The confirmation flag expresses the UI action, not authorization. A previously loaded form context is not authority to write financial data.

One `db.transaction` covers validation, the Expense with splitMethod EQUAL when shares match the deterministic baseline, otherwise CUSTOM, every ExpenseParticipant and EXPENSE_CREATED. The event actor is the authenticated GroupMember, which can differ from the chosen payer. A guarded no-op group update locks currency and serializes group expense saves. Selected membership rows are locked in ID order using guarded updateAll calls so they stay active and in-group until commit. Any failed write throws and rolls back all records. Review requests never write records. Locking behaviour still needs live PostgreSQL concurrency verification.

`getExpensesForGroup` in `src/data/groups.ts` is an internal read helper called only after group authorization. It batches payer and participant reads and returns the latest 50 expenses with deterministic date/ID ordering. Both group pages use the same `ExpenseList` component with expandable persisted shares in natural member order. Shared MemberList and ActivityList components provide joined/waiting states, current identity and consistent cards. Responsive group headers put Add expense beside the group identity.

## Limits and next work

One current guest cookie per browser; no session recovery, identity switching or multi-group guest-session UI. Rate limiting and live database concurrency/rollback testing remain outstanding. Group creation has no server-side idempotency guarantee.

Expense submission has no durable idempotency key: a replay or retry after a lost successful response can create another expense. Pending UI does not guarantee exactly-once saving. Balances, expense editing, percentage splits, payments and settlements are not implemented. The recommended next product milestone is group balances, after live expense-flow verification. See [testing evidence](tests.md), [owner data flow](group-creation.md) and [database design](database-design.md).

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


![SPLITMate System Architecture](images/system-architecture.png)

## Overview

SplitMate will use a client-server architecture consisting of a web frontend, REST API backend and relational PostgreSQL database.

The frontend will be responsible for presenting the user interface and communicating with the backend through HTTPS requests.

The backend will contain the application's business logic, including expense calculations, balance calculations, group management and payment tracking.

PostgreSQL will provide persistent storage for users, groups, expenses and payments.

## Planned Architecture

The main components are:

* **Frontend:** Next.js, React and TypeScript
* **Backend:** Python and FastAPI
* **Database:** PostgreSQL
* **API:** RESTful API
* **Version Control:** Git and GitHub

## Data Flow

When a user creates an expense, the frontend sends the expense information to the FastAPI backend through the REST API.

The backend validates the request, calculates the relevant participant shares and stores the expense and participant information in PostgreSQL.

When the user views their group balance, the backend retrieves the relevant expenses and payments and calculates their current net balance.

## Design Considerations

A relational database was selected because SplitMate contains several strongly related entities, including users, groups, expenses, participants and payments.

The application will separate presentation, business logic and data storage to make the system easier to maintain, test and extend.

</details>
