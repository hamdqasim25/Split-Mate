# SPLITMate Development Roadmap

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed

- Next.js App Router, TypeScript and Tailwind foundation.
- Prisma 8 RC and Prisma-hosted PostgreSQL, including separate UserSession and GuestSession models.
- Owner register/login/logout backend, session utilities and login/register UI.
- Server-side protection of dashboard and group creation pages.
- Authenticated group creation through `/api/groups`, deriving ownership from the server session.
- Transactional Group, secure share token, owner/guest members and GROUP_CREATED activity.
- Live cloud-database verification of group creation.
- Persisted owner dashboard: name, owned groups, active member counts and recent events; no fake balances or exposed share token.
- 120 local tests passing across four suites; targeted lint, TypeScript and production build passing.

### Next - ordered milestones

1. Owner group detail page.
2. Clickable dashboard group cards.
3. Group members/activity view.
4. Reusable share-link controls.
5. Public `/g/[shareToken]`.
6. Guest member claiming and `GuestSession`.
7. Then expenses, balances and repayments.

Owner detail access must verify ownership server-side. Guests must remain able to participate without registering. A share link identifies a group, while an authenticated owner session or valid GuestSession establishes the caller's identity.

### Future

- Optional account linking without duplicating GroupMember history.
- Member management and broader activity coverage.
- Unequal splitting, settlement optimisation and notifications as separately scoped features.
- Production hardening, including rate limiting before public deployment and consideration of server-side request idempotency.

The financial milestone includes deterministic splitting/rounding and repayments marked SENT by the payer, then CONFIRMED by the receiver. No current balance engine is claimed.

See [progress and test evidence](progress-report.md). Original stages below are historical, not the current work queue.

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
