# SPLITMate Progress Report

## Implementation and testing notes — 17 September 2026

This section was added during implementation and testing. It records the current milestone separately from the original development log below; historical entries describe what was true at their recorded dates.

### Database milestone carried forward — 13 September 2026

The guest-member redesign is recorded in migration `20260913T2223_guest_members_and_activity` and commit `57fb300`. The project records it as applied and verified before this implementation work. This documentation update did not reconnect to the cloud database or independently repeat that verification.

The current contract contains eight models: User, Group, GroupMember, Expense, ExpenseParticipant, Payment, ActivityEvent and GuestSession. GroupMember now supports guests with null `userId`; expense and payment relationships use GroupMember IDs. Groups have reusable share tokens, and guest sessions have a token-hash field.

### Implemented during the group-creation milestone

- Added the internal server-only service in `src/data/groups.ts`, using the existing Prisma client and `tx.orm.public` namespace.
- Added server validation for group details, GBP currency, guest count, blank names, duplicate names and unsupported fields.
- Generated a share token using 32 cryptographically random bytes.
- Created the Group, claimed owner GroupMember, unclaimed guest GroupMembers and GROUP_CREATED activity record inside one transaction.
- Selected the owner's name from the User record and returned a group summary without the share token.
- Added 32 unit tests and documented the service's authentication boundary and limitations.

No authentication system or public endpoint was added. The form and dashboard still contain presentation code only. The temporary database test route mentioned in the original notes is already absent.

### Verification performed during implementation

| Check | Result | What it establishes |
| --- | --- | --- |
| `node --test tests/create-group.test.mjs` | 32 passed | Input validation, identity assignment, token format, activity actor and error propagation through a transaction double |
| `npx --no-install tsc --noEmit --incremental false` | Passed | Compatibility with the installed TypeScript and Prisma contract types |
| `npx --no-install eslint src/data/groups.ts tests/create-group.test.mjs tests/helpers/group-database.mjs` | Passed | Lint for the new implementation and tests |
| `npm run build` | Passed after allowing the existing Google Fonts download | Existing application production build and TypeScript checks |
| `npm run lint` | 12 errors and 58 warnings | Existing generated Prisma declarations and bundled tooling are included in the repository-wide lint scan |

On this Windows setup, PowerShell blocked the `npm.ps1` and `npx.ps1` wrappers. The same commands were run with `npm.cmd` and `npx.cmd`.

The database double does not prove PostgreSQL rollback. No live group-creation request, authenticated browser flow or database integration test was performed. The service is not yet imported by a route, so the production build also does not establish a working HTTP creation flow.

### Lessons and remaining work

A transaction keeps related writes together, but the caller still needs real authentication. Looking up an existing User is not proof of the caller's identity. Likewise, a share token gives access to a group; it does not identify a particular member.

The next steps are owner authentication, an authenticated submission boundary with safe errors and request protection, form wiring and database-backed dashboard queries. Request deduplication is still needed: repeated successful service calls currently create separate groups.

The applied migrations and generated contract were preserved. The old `npx prisma@latest` commands below are historical records, not current instructions. Use the locally installed Prisma CLI, review any new migration, and obtain approval before applying it.

### Documentation follow-up

During this implementation and testing cycle, dated updates were added to the README, roadmap, architecture, database design, project structure, requirements and user stories. Their original notes are retained for learning and comparison. See [group-creation.md](group-creation.md) for the backend contract.

---

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


This file tracks the main development milestones, technical decisions, and lessons learned while building SPLITMate.

---

## Current Status

**Stage:** 2 — Project Setup & Backend Foundation

**Current focus:** Building the user registration and authentication backend.

### Current Progress

The initial backend and database foundation is now working.

Completed so far:

- Next.js application created and connected to GitHub
- Core UI routes created
- SPLITMate database ERD converted into Prisma models
- Hosted PostgreSQL database configured
- Prisma data contract generated
- Initial database migration created and applied
- Database structure and migration state verified
- Next.js successfully connected to PostgreSQL through Prisma
- Test user successfully created and retrieved from PostgreSQL
- `bcryptjs` installed in preparation for secure password hashing

Current backend flow:

```text
Next.js
   ↓
Prisma
   ↓
PostgreSQL
```

The next development milestone is implementing real user registration.

---

# Completed Milestones

## 2026-09-05 — Development Environment Setup

Completed:

- Installed and configured VS Code
- Installed Node.js and npm
- Installed Git
- Created the local SPLITMate project folder

Learned:

- npm manages project packages
- Git tracks local changes
- GitHub stores the remote repository

---

## 2026-09-05 — Next.js Application Setup

Completed:

- Created the Next.js application
- Enabled TypeScript
- Confirmed the application runs locally with:

```powershell
npm run dev
```

- Connected the project to GitHub

Commit:

```text
Initialize Next.js application
```

---

## 2026-09-05 — Landing Page

Completed:

- Replaced the default Next.js page
- Added SPLITMate branding
- Added hero section
- Added example expenses
- Added "How it works" section
- Added navigation using Next.js `Link`

Route:

```text
/
```

---

## 2026-09-05 — Dashboard

Completed:

- Created the dashboard page
- Changed "Get started" navigation to `/dashboard`
- Added dashboard metadata
- Added navigation back to the homepage

Route:

```text
/dashboard
```

Learned:

- Next.js App Router uses folders to create routes
- New files remain untracked by Git until added

---

## 2026-09-05 — Create Group Page

Completed:

- Created the group creation form
- Added group name field
- Added member fields
- Added dashboard navigation
- Added Create Group and Cancel actions

Route:

```text
/groups/new
```

Current limitation:

- The form is UI-only and does not yet save data

Troubleshooting:

- Fixed a Next.js error where the default export was not recognised as a React component

---

## 2026-09-05 — Prisma & PostgreSQL Setup

Completed:

- Added Prisma to the existing Next.js project
- Created a hosted Prisma Postgres database
- Claimed the database
- Stored the database connection string in `.env`
- Confirmed `.env` is ignored by Git
- Rotated the original database credentials after they were exposed

Architecture:

```text
Next.js
   ↓
Prisma
   ↓
PostgreSQL
```

---

## 2026-09-05 — Prisma Data Contract

Completed:

- Removed the default Prisma demo models
- Converted the SPLITMate ERD into Prisma models
- Added:

```text
User
Group
GroupMember
Expense
ExpenseParticipant
Payment
```

- Added model relationships and foreign-key definitions
- Added uniqueness constraints for:
  - group membership
  - expense participation
  - user email
- Generated the Prisma contract files

Command:

```powershell
npx prisma contract emit
```

Generated:

```text
src/prisma/contract.json
src/prisma/contract.d.ts
```

---

## 2026-09-05 — Git & Repository Cleanup

Completed:

- Added `.gitattributes`
- Updated `.gitignore`
- Prevented Prisma AI/tooling folders from being committed:

```text
.agents/
.claude/
.cursor/
.devin/
```

- Added project documentation
- Committed the Prisma backend foundation

Commit:

```text
Add Prisma backend foundation and create group page
```

Troubleshooting:

- GitHub contained remote changes not available locally
- Used:

```powershell
git pull --rebase origin main
```

- Resolved a conflict in `README.md`

---

## 2026-09-06 — Initial Database Migration

Completed:

- Generated the first PostgreSQL migration from the Prisma contract
- Reviewed the generated SQL operations
- Created all six SPLITMate database tables
- Added primary keys
- Added foreign-key relationships
- Added database indexes
- Added unique constraints

Command:

```powershell
npx prisma@latest migration plan --name initial-schema
```

Migration:

```text
migrations/app/20260906T2009_initial_schema
```

Result:

```text
30 operations planned
```

---

## 2026-09-06 — PostgreSQL Schema Initialised

Completed:

- Applied the initial migration to the hosted PostgreSQL database
- Created the `public` schema
- Created:

```text
user
group
groupMember
expense
expenseParticipant
payment
```

- Applied all indexes, constraints and foreign keys
- Advanced the Prisma database reference to the current contract

Command:

```powershell
npx prisma@latest db migrate --advance-ref db
```

Result:

```text
1 migration applied
30 operations completed
```

---

## 2026-09-06 — Database Migration Verified

Completed:

- Checked the database against the migration history
- Confirmed the PostgreSQL database matches the current Prisma contract

Command:

```powershell
npx prisma@latest migration status
```

Result:

```text
✔ Up to date
```

This confirmed that the database schema, migration history and Prisma contract are synchronised.

---

## 2026-09-06 — Next.js Database Connection Test

Completed:

- Configured the Prisma PostgreSQL client in:

```text
src/prisma/db.ts
```

- Created a temporary Next.js API route for database testing
- Sent a POST request to the API
- Successfully created a test user in PostgreSQL
- Successfully retrieved the same user through Prisma
- Confirmed database-generated fields including:
  - `id`
  - `createdAt`

Tested architecture:

```text
PowerShell
   ↓
Next.js API Route
   ↓
Prisma
   ↓
PostgreSQL
```

Result:

```text
Database connection working
```

This confirmed that the application can successfully create and retrieve database records.

---

## 2026-09-06 — Authentication Preparation

Completed:

- Installed `bcryptjs`
- Prepared the project for secure password hashing
- Established that password hashes will remain server-side and will not be returned through API responses

Command:

```powershell
npm install bcryptjs
```

The next authentication work will replace the temporary database test route with real registration functionality.

---

# Next Steps

## Immediate

- Remove the temporary `/api/test-db` route
- Create the `POST /api/auth/register` endpoint
- Validate the user's name, email and password
- Check whether the email is already registered
- Hash passwords securely using `bcryptjs`
- Save registered users to PostgreSQL
- Test successful and unsuccessful registration requests

Once registration is working, the next milestone will be user login and authentication.

---

# Project Structure

The current repository structure is maintained separately in:

```text
docs/project-structure.md
```

This keeps the progress report focused on development history while allowing the project structure document to be updated independently.

---

# Development Workflow

For each meaningful milestone:

```text
Build
  ↓
Test
  ↓
Update documentation
  ↓
git add .
  ↓
git commit
  ↓
git push
```

Use clear commit messages that describe the milestone being completed.
