# SPLITMate Development Roadmap

## Completed

- Owner authentication and database-backed sessions.
- Atomic group creation and persisted dashboard/groups.
- Owner-only details, members/activity and share-link display/copy.
- Guest invite resolution and secure member claiming.
- GuestSession authentication and protected guest group access.
- Guest member/activity display, five-minute activity tracking and device sign-out.
- Automated tests and milestone verification; see [tests.md](tests.md).

## Next: Expense creation and splitting

Implement a focused expense-creation slice with authenticated owner/guest identity, same-group payer and participant validation, group currency, deterministic equal splitting and atomic EXPENSE_CREATED logging. Do not infer completed workflows from existing financial tables.

## Later

- Balances and repayments, preserving payer SENT → receiver CONFIRMED.
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
