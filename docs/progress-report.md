# SPLITMate Progress Report

This file tracks the main development milestones, technical decisions, and lessons learned while building SPLITMate.

---

## Current Status

**Stage:** 2 — Project Setup & Backend Foundation

**Current focus:** Initialising and verifying the PostgreSQL database using Prisma.

---

## Completed Milestones

### 2026-09-05 — Development Environment Setup

Completed:

- Installed and configured VS Code
- Installed Node.js and npm
- Installed Git
- Set up the local SPLITMate project folder

Learned:

- npm manages project packages
- Git tracks local changes
- GitHub stores the remote repository

---

### 2026-09-05 — Next.js Application Setup

Completed:

- Created the Next.js application
- Enabled TypeScript
- Confirmed the app runs locally with:

```powershell
npm run dev
```

- Connected the project to GitHub

Commit:

```text
Initialize Next.js application
```

---

### 2026-09-05 — Landing Page

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

### 2026-09-05 — Dashboard

Completed:

- Created the dashboard page
- Changed "Get started" links from `/groups` to `/dashboard`
- Added dashboard metadata
- Added navigation back to the homepage

Route:

```text
/dashboard
```

Learned:

- Next.js App Router uses folders to create routes
- New files appear as untracked until added to Git

---

### 2026-09-05 — Create Group Page

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

### 2026-09-05 — Prisma & PostgreSQL Setup

Completed:

- Added Prisma to the existing Next.js project
- Created a hosted Prisma Postgres database
- Claimed the database
- Stored the connection string in `.env`
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

### 2026-09-05 — Prisma Data Contract

Completed:

- Removed the default Prisma `User` and `Post` demo models
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

- Added model relationships
- Added uniqueness constraints for:
  - group membership
  - expense participation

Command:

```powershell
npx prisma contract emit
```

Result:

- Prisma successfully generated the contract files

---

### 2026-09-05 — Git & Repository Cleanup

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

- Added the project progress report
- Committed Prisma backend work

Commit:

```text
Add Prisma backend foundation and create group page
```

Troubleshooting:

- Remote GitHub branch had changes not present locally
- Used:

```powershell
git pull --rebase origin main
```

- Resolved a conflict in `README.md`

---

# Current Project Structure

```text
Split-Mate/
├── docs/
│   └── progress-report.md
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── groups/
│   │   │   └── new/
│   │   └── page.tsx
│   └── prisma/
│       ├── contract.prisma
│       ├── contract.json
│       ├── contract.d.ts
│       └── db.ts
├── .env
├── .gitignore
├── package.json
└── prisma.config.ts
```

---

# Next Steps

## Immediate

- Initialise the PostgreSQL schema
- Verify the database structure
- Confirm Prisma can communicate with the database

## Core Features

- Save groups to PostgreSQL
- Display real groups on the dashboard
- Add group members
- Create expenses
- Split expenses
- Calculate balances
- Record repayments

## Later

- Authentication
- Protected routes
- Validation
- Testing
- Deployment
- CI/CD
- Logging and monitoring

---

# Development Workflow

For each meaningful milestone:

```text
Build
  ↓
Test
  ↓
Update progress report
  ↓
git add .
  ↓
git commit
  ↓
git push
```

Use clear commit messages such as:

```text
Initialize database schema
Connect group creation to database
Load groups on dashboard
Add expense creation flow
Implement balance calculation
```
