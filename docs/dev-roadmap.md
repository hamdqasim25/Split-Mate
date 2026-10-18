# SPLITMate Development Roadmap

## Completed

- Owner authentication and database-backed sessions.
- Atomic group creation and persisted dashboard/groups.
- Owner-only details, members/activity and share-link display/copy.
- Guest invite resolution and secure member claiming.
- GuestSession authentication and protected guest group access.
- Guest member/activity display, five-minute activity tracking and device sign-out.
- Automated tests and milestone verification; see [tests.md](tests.md).

- Shared expense backend foundation: authenticated GroupMember resolution, same-group authorization and minimal active-member form context.
- One reusable owner/guest expense form with payer default, participant multi-select and server-calculated confirmation.
- Validated GBP expense persistence, deterministic equal splitting in integer pence, atomic participants/EXPENSE_CREATED and shared expense lists.

- Editable custom shares, exact-total validation and reset to equal; natural member order and improved owner/guest group pages.

- Complete-ledger GBP member balances on owner/guest pages, exact paid/share/net totals, historical inactive members and explicit reconciliation failure.

- Guest external-payment reporting; owner confirmation/rejection and direct recording; exact confirmed-payment balance adjustments, pending reservations and durable creation keys. Migration applied and schema verified on the configured database.

## Next: Deployment verification and expense retry safety

The user has manually verified owner/guest payment flows and dashboard balances. Verify PostgreSQL lock/rollback behaviour under concurrency. Next implementation work should add durable expense-submission idempotency to prevent duplicate expenses after lost responses.

## Later

- Expense editing and percentage splitting.
- Durable expense-submission idempotency for safe retries after lost responses.
- Broader payment lifecycle controls only after explicit product decisions; current confirmation authority is the group owner.
- Optional account linking without duplicating GroupMember/history.
- Member management and invite disable/regeneration controls.
- Session recovery and multi-group guest access.
- Broader split methods, settlement improvements and notifications.

Rate limiting is required before public deployment. Live database concurrency/rollback tests and server-side creation idempotency remain separate work. [README](../README.md) holds concise current progress; [architecture](architecture.md) defines access boundaries.

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


### Stage 1 — Planning ✅
- Define problem
- Define project requirements
- Define core features

### Stage 2 — System Design ✅
- Application architecture
- Database ERD
- Database documentation

### Stage 3 — Application Setup ✅
- Create Git repository
- Initialise Next.js
- Build initial UI structure

### Stage 4 — Database Implementation 🚧
- Create database
- Write SQL schema
- Create tables
- Define primary keys
- Define foreign keys
- Add constraints
- Test relationships

### Stage 5 — Backend Integration
- Connect Next.js to database
- Implement database queries
- Create API/backend logic

### Stage 6 — Core Features
- Users
- Groups
- Expenses
- Expense splitting
- Payments

</details>
