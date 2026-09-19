# SPLITMate

SPLITMate helps groups track shared expenses while keeping account creation optional for guests. The implemented milestone is authenticated group creation and an owner dashboard backed by PostgreSQL. Expense calculations and repayments are still planned.

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed

- Next.js App Router, React, TypeScript and Tailwind CSS; backend routes and services run in the Next.js application.
- Prisma 8 RC contract workflow and Prisma-hosted PostgreSQL, using the installed release-candidate toolchain.
- Owner registration, login and POST logout, with database-backed `UserSession`. Registration creates an account, then sends the owner to login.
- Login/register UI, session-aware landing actions, and server-side guards directly in `/dashboard` and `/groups/new`.
- `User` is an account; `GroupMember` is the identity inside a group. Guests have `userId = null` and do not need accounts. Guest access is a later milestone.
- `/groups/new` submits to `POST /api/groups`. The endpoint derives the owner from the server session, never a client-supplied owner ID.
- One transaction creates the Group with a cryptographically secure reusable `shareToken`, claimed owner GroupMember, unclaimed guest GroupMembers and owner-attributed `GROUP_CREATED` ActivityEvent.
- The dashboard displays the real owner name, persisted owned groups, active member counts and latest five real activity events. It excludes share tokens and replaces fake balances with neutral placeholders.
- Group creation was live-tested against Prisma cloud PostgreSQL; a subsequent read-only check confirmed persisted group/member/activity data.

### Next

1. Owner group detail page.
2. Clickable dashboard group cards.
3. Group members/activity view.
4. Reusable share-link controls.
5. Public `/g/[shareToken]`.
6. Guest member claiming and `GuestSession`.
7. Then expenses, balances and repayments.

### Future

Optional guest account linking, member management, richer splitting and settlement features. Rate limiting is required before public deployment; it is not implemented yet. A generated share token does not yet provide public guest access.

### Verification

| Check | Latest implementation result |
| --- | --- |
| `node --test tests/auth-pages.test.mjs` | 38 passed |
| `node --test tests/dashboard.test.mjs` | 18 passed |
| `node --test tests/create-group.test.mjs` | 32 passed |
| `node --test tests/auth.test.mjs` | 32 passed |
| Targeted ESLint for changed implementation/test files | Passed |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed |

These 120 tests use local mocks; they do not write cloud records. Results are from the completed implementation/testing cycle, not a new test run for this documentation-only update. On Windows, `npm.cmd` and `npx.cmd` were used where PowerShell blocked the `.ps1` wrappers.

### Local development and documentation

Use `npm ci` and `npm run dev` with privately configured database connections. Never commit connection strings. Use the locally installed Prisma CLI; ordinary setup must not apply migrations or upgrade the RC packages.

- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Group creation and dashboard reads](docs/group-creation.md)
- [Progress and verification limits](docs/progress-report.md)
- [Roadmap](docs/dev-roadmap.md)
- [Project structure](docs/project-structure.md)
- [Requirements](docs/requirements.md) and [user stories](docs/user-stories.md)

The original architecture and ERD images below describe earlier proposals, not the current implementation.

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


SplitMate is a group expense management application designed to
simplify tracking shared expenses and repayments between friends.

See the current development roadmap progress:
[Development Roadmap](docs/dev-roadmap.md)

## Problem

When a large group participates in an activity, one person may pay
for everyone. Tracking who owes what through WhatsApp messages,
notes or spreadsheets can become difficult.

See the user stories:
[User Stories](docs/user-stories.md)

## Solution

SplitMate maintains a centralised expense ledger that calculates
individual balances and provides an optimised settlement plan.

## Planned Features

- User accounts
- Groups
- Group invitations
- Shared expenses
- Equal and unequal splitting
- Balance calculation
- Payment tracking
- Settlement optimisation
- Notifications

## Planned Technology

Frontend:
Next.js / React / TypeScript

Backend:
Python / FastAPI

Database:
PostgreSQL

Deployment:
Docker / Cloud infrastructure

CI/CD:
GitHub Actions

See the planned application requirements:
[Requirements](docs/requirements.md)

## System Architecture

The following diagram illustrates the planned architecture of SplitMate
and the communication between the frontend, backend and database.

See the full system architecture documentation:
[Architecture Design](docs/architecture.md)

![SplitMate System Architecture](docs/images/system-architecture.png)

## Database Design

SplitMate uses PostgreSQL to store users, groups, expenses,
participants and repayments.

The database follows a relational structure with foreign keys
used to maintain relationships between users, groups and expenses.

See the full database design documentation:
[Database Design](docs/database-design.md)

![SplitMate Database ERD](docs/images/database-erd.png)

## Current Progress

SPLITMate is currently in the backend authentication stage.

Completed:

- Project requirements and feature planning
- Initial system design
- Database ERD
- Database schema design
- Next.js project setup
- Initial dashboard and group creation pages
- Prisma and PostgreSQL setup
- Prisma data contract generation
- Initial database migration created and applied
- Database tables, relationships, indexes, and constraints created
- Database migration status verified
- Next.js successfully connected to PostgreSQL through Prisma
- Test user successfully created and retrieved from the database
- `bcryptjs` installed for password hashing
- Server-only transactional group creation service; authentication and UI integration are pending ([backend details](docs/group-creation.md))

Currently working on:

- Building the user registration API
- Validating registration data
- Hashing user passwords securely
- Saving registered users to PostgreSQL

Next:

- Implement user login and authentication
- Connect group creation to the database
- Add group member functionality
- Begin expense and payment functionality

</details>
