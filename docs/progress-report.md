# SPLITMate Progress Report

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed

- Owner authentication backend and UI: registration, login, POST logout, hashed database-backed UserSession, generic credential errors and same-origin mutation protection.
- Protected owner dashboard and group creation pages; login returns only to the two allowed owner routes using a fresh request.
- Connected group form and `/api/groups` endpoint; ownership is taken from the verified server session.
- Atomic creation of Group, secure reusable share token, claimed owner identity, unclaimed guest identities and GROUP_CREATED activity.
- Persisted dashboard with real owner name, owned groups, active member counts and five latest events. No fake balance values and no share-token exposure.
- Separate User accounts and GroupMember identities; guest userId remains nullable.

### Verification recorded during implementation and testing

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

Targeted lint passed; this is not a claim that repository-wide `npm run lint` is clean. Earlier full scans reported generated/tooling findings (12 errors and 58 warnings); that full scan was not rerun for this update.

### Live checks and limits

The owner group-creation browser flow was successfully tested against Prisma-hosted PostgreSQL. The Group, OWNER GroupMember with claimedAt, guest members with null userId/claimedAt, and owner-attributed GROUP_CREATED event were verified. The UserSession migration had already been applied and verified using migration status and schema verification.

A subsequent read-only check of the new dashboard service returned the existing test group with four active members, GBP and one event; no shareToken was returned and no records were changed. A connected browser was unavailable for a separate manual dashboard rendering check. Mock tests exercise rollback/error propagation; live PostgreSQL rollback failure injection is still unverified.

The live read emitted an existing PostgreSQL driver SSL-mode compatibility warning; no environment or dependency changes were made. Some earlier builds needed network access to download the existing Google Fonts. The latest production build passed.

### Next

1. Owner group detail page.
2. Clickable dashboard group cards.
3. Group members/activity view.
4. Reusable share-link controls.
5. Public `/g/[shareToken]`.
6. Guest member claiming and `GuestSession`.
7. Then expenses, balances and repayments.

### Future

Optional account linking, member management and additional splitting/settlement features. Rate limiting is a pre-public-deployment requirement. The group form's pending state is not server-side idempotency. GuestSession storage and financial tables are present, but their workflows are not yet implemented.

### Documentation checkpoint

This update aligns public documentation with the completed authentication, group creation and dashboard milestones. It changes documentation only. Original development notes and diagrams remain below or in their respective documents for historical comparison. Old `prisma@latest` commands are historical records, not current setup instructions; use the locally installed CLI and separately review/approve migrations.

---

<details>
<summary>Historical original notes - not current implementation</summary>

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

</details>
