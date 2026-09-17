# SplitMate

## Implementation and testing notes — 17 September 2026

These notes were added during implementation and testing to record the repository's current state. The original project notes are preserved separately below, including earlier technology choices and plans that have since changed.

SPLITMate is being built around an account-owning group creator and guests who can participate without registering. A `User` is an account; a `GroupMember` is a person's identity within one group. Financial records reference GroupMember identities.

### Current implementation

- **Application:** Next.js App Router, React, TypeScript and Tailwind CSS. The backend service runs in the Next.js project using Node.js.
- **Data layer:** Prisma 8 release candidate with an authored contract and generated artifacts in `src/prisma/`, connected to Prisma-hosted PostgreSQL.
- **Pages:** `/`, `/dashboard` and `/groups/new`. The dashboard uses sample data and the group form is not connected to the backend.
- **Group creation backend:** [`createGroup`](src/data/groups.ts) validates input and creates the Group, a secure share token, the owner's GroupMember, guest GroupMembers and a GROUP_CREATED activity record in one transaction.
- **Current limits:** GBP, up to 50 guests, distinct member names, and an existing owner User. The service requires a verified owner ID from a future authentication boundary.

Authentication, a public group-creation endpoint, form submission, dashboard database queries, guest claiming and expense/payment behaviour remain unimplemented. A share token is generated, but the shared `/g/[shareToken]` route is still planned.

### Verification during backend implementation

All 32 unit tests, TypeScript checks, lint for the new service/tests, and the production build passed. Repository-wide lint reported 12 errors in existing generated Prisma declarations and 58 warnings in existing generated/tooling files. The tests use a database double; live PostgreSQL writes and rollback were not tested.

See the [progress report](docs/progress-report.md) for commands, results and limitations, and the [roadmap](docs/dev-roadmap.md) for the remaining implementation sequence.

### Current documentation

- [Architecture](docs/architecture.md)
- [Database design](docs/database-design.md)
- [Group creation backend](docs/group-creation.md)
- [Project structure](docs/project-structure.md)
- [Requirements](docs/requirements.md) and [user stories](docs/user-stories.md)

### Local development

Install the locked dependencies with `npm ci`, then run `npm run dev`. Backend unit tests currently use Node 24: `node --test tests/create-group.test.mjs`. Database operations require the project's privately configured environment; never commit connection strings.

Use the locally installed Prisma CLI for this release-candidate toolchain. Do not upgrade Prisma or apply migrations as part of ordinary setup. The database contract and migration history were unchanged by this backend implementation.

---

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
