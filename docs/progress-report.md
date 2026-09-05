# SPLITMate Development Progress

This document records the development of **SPLITMate** from the point where the initial system architecture and database design had been completed and implementation began.

The purpose of this log is to keep a clear record of:

- what was built;
- why particular technologies and approaches were chosen;
- technical concepts learned during development;
- problems encountered and how they were resolved;
- the current state of the project;
- the next planned development tasks.

> **Note:** Git commit messages are recorded where they are known. For development steps that were completed before this progress log was introduced, the entry describes the work completed without inventing a commit hash or message.

---

# Project Status

**Current stage:** Stage 2 — Project Setup & Backend Foundation

**Current focus:** Converting the completed SPLITMate database design into a working PostgreSQL database using Prisma.

## Overall Roadmap

| Stage | Status | Description |
|---|---|---|
| Stage 1 — Planning & Design | ✅ Complete | Requirements, architecture, user flow, ERD and database documentation |
| Stage 2 — Project Setup & Backend Foundation | 🟡 In Progress | Next.js, Git/GitHub, frontend routes, PostgreSQL and Prisma |
| Stage 3 — Core Application | ⬜ Not Started | Groups, members, expenses, splits, balances and repayments |
| Stage 4 — User Accounts & Authentication | ⬜ Not Started | Registration, login, protected routes and permissions |
| Stage 5 — Quality & Security | ⬜ Not Started | Validation, error handling, testing, accessibility and security |
| Stage 6 — Deployment & DevOps | ⬜ Not Started | Production deployment, CI/CD, monitoring and final documentation |

---

# Starting Point

Before implementation began, SPLITMate had already gone through its initial planning and design stage.

The project had:

- a defined problem and project idea;
- planned application requirements;
- a high-level system architecture;
- a relational database design;
- an Entity Relationship Diagram (ERD);
- database design documentation;
- six planned core database entities:
  - `USERS`
  - `GROUPS`
  - `GROUP_MEMBERS`
  - `EXPENSES`
  - `EXPENSE_PARTICIPANTS`
  - `PAYMENTS`

The implementation phase therefore began with an existing design rather than creating the application structure while coding.

---

# Development Log

## 2026-09-05 — Development Environment Setup

### Objective

Prepare a local development environment capable of building, running and version-controlling SPLITMate.

### Completed

- Installed and configured **Visual Studio Code** as the main development editor.
- Installed **Node.js/npm** to support JavaScript/TypeScript development and package management.
- Installed and configured **Git** for local version control.
- Prepared the local SPLITMate project directory.
- Used the VS Code integrated terminal / PowerShell to run development and Git commands.

### Technologies Introduced

**Visual Studio Code**

Used as the main IDE/editor for:

- editing TypeScript and TSX files;
- managing the project directory;
- running terminal commands;
- viewing Git file status;
- creating new routes and application files.

**Node.js**

Provides the JavaScript runtime and tooling required by the Next.js development environment.

**npm**

Used to install and manage project dependencies and run project scripts.

**Git**

Used to maintain a version history of SPLITMate locally.

### Concepts Learned

- A source-code editor and a runtime are separate tools.
- npm manages the packages required by the application.
- Git tracks changes to files over time.
- GitHub stores the remote version of the Git repository.

---

## 2026-09-05 — Next.js Application Initialisation

### Objective

Create the actual web application that will become SPLITMate.

### Completed

- Initialised a **Next.js** project.
- Configured the project with **TypeScript**.
- Created the default Next.js project structure.
- Installed the initial npm dependencies.
- Confirmed the project could be run locally.
- Reviewed the main generated application files.

### Important Project Files

```text
Split-Mate/
├── public/
├── src/
│   └── app/
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
└── tsconfig.json
```

### Local Development

The application is started with:

```powershell
npm run dev
```

The local site can then be viewed at:

```text
http://localhost:3000
```

Next.js automatically refreshes the application when saved source files change during development.

### Concepts Learned

- Next.js is the application framework rather than simply a hosting service.
- It can provide frontend pages, routing and server-side functionality.
- `src/app/page.tsx` represents the `/` route when using the Next.js App Router.
- `layout.tsx` provides shared layout around application pages.
- `globals.css` stores global styling.

### Git Commit

```text
Initialize Next.js application
```

Known commit:

```text
ef4c68b
```

This commit added the initial Next.js application to the repository.

---

## 2026-09-05 — GitHub Repository Integration

### Objective

Store the project remotely and create a visible development history.

### Completed

- Connected the local Git repository to GitHub.
- Authenticated Git with GitHub when pushing.
- Pushed the initial Next.js application to the remote repository.
- Established the basic Git development workflow.

### Development Workflow

```text
Edit files
   ↓
Test locally
   ↓
git status
   ↓
git add
   ↓
git commit
   ↓
git push
```

### Useful Commands

Check changed and untracked files:

```powershell
git status
```

Stage all current changes:

```powershell
git add .
```

Create a commit:

```powershell
git commit -m "Commit message"
```

Push commits to GitHub:

```powershell
git push
```

### Concepts Learned

- **Untracked** means Git can see a new file but is not yet tracking it.
- `git add` stages files for the next commit.
- `git commit` creates a local version-history checkpoint.
- `git push` sends local commits to the GitHub remote repository.

---

## 2026-09-05 — SPLITMate Landing Page

### Objective

Replace the default Next.js page with a frontend that represents the SPLITMate product.

### Completed

- Replaced the default Next.js content with a custom SPLITMate landing page.
- Added SPLITMate branding and navigation.
- Added a hero section explaining the core product.
- Added a visual example of a shared expense group.
- Added example expenses and balances.
- Added a **How it works** section.
- Added responsive styling with Tailwind utility classes.
- Added calls to action using Next.js `Link`.

### Landing Page Message

The page presents the core SPLITMate idea:

> Split expenses. Keep friendships simple.

The example group demonstrates:

- total group expenses;
- recent expenses;
- who paid;
- individual share;
- total paid;
- amount owed back to the user.

### Example Data

The landing page currently uses hard-coded example data for presentation purposes.

Example:

```text
Weekend Trip
Total group expenses: £240.00

Somewhere to stay   £120.00
Dinner together      £75.00
Train tickets        £45.00
```

This data is not connected to the database.

### Concepts Learned

- React/Next.js pages are built using reusable JSX/TSX structures.
- Arrays can be mapped into repeated UI elements.
- Next.js `Link` is used for internal application navigation.
- Hard-coded mock data is useful for developing a UI before the backend exists.

---

## 2026-09-05 — Application Routing

### Objective

Create a clear route structure for moving from the public landing page into the application.

### Initial Decision

The **Get started** buttons originally linked to:

```text
/groups
```

After reviewing the future application structure, the route was changed to:

```text
/dashboard
```

### Reason for the Change

A dashboard gives SPLITMate room to display more than groups.

It can eventually contain:

- all active groups;
- total amount owed to the user;
- total amount the user owes;
- recent activity;
- shortcuts for creating groups;
- recent expenses.

### Planned Route Structure

```text
/
├── dashboard
├── groups
│   ├── new
│   └── [id]
│       └── expenses
│           └── new
```

Potential routes:

```text
/
 /dashboard
 /groups
 /groups/new
 /groups/[id]
 /groups/[id]/expenses/new
```

### Troubleshooting

After changing the links to `/dashboard`, the browser initially continued navigating to `/groups`.

The issue was resolved by searching the project for old `/groups` references, saving the relevant files and confirming the updated route.

### Concepts Learned

- Next.js App Router uses folders to define URLs.
- A `page.tsx` file inside a folder creates a route.
- Project-wide search in VS Code is useful when an old route or string is still referenced elsewhere.

---

## 2026-09-05 — Dashboard Page

### Objective

Create the main application page users reach after selecting **Get started**.

### Route

```text
/dashboard
```

### File

```text
src/app/dashboard/page.tsx
```

### Completed

- Created the dashboard route.
- Added page metadata:
  - title;
  - description.
- Added navigation back to the homepage.
- Added an initial dashboard heading and description.
- Created an initial placeholder overview area.
- Confirmed navigation from the landing page to `/dashboard`.

### Initial Purpose

The dashboard will eventually display:

- user groups;
- balances;
- recent expenses;
- recent activity;
- actions such as creating a new group.

### Git Lesson

When `dashboard/page.tsx` was created, VS Code displayed it as **untracked**.

This was expected because it was a newly created file.

The file becomes tracked after:

```powershell
git add src/app/dashboard/page.tsx
```

or:

```powershell
git add .
```

### Concepts Learned

- A file existing locally does not automatically mean Git tracks it.
- New application routes must also be staged and committed to the repository.

---

## 2026-09-05 — Create Group Page

### Objective

Create the first form-based workflow for the application's core functionality.

### Route

```text
/groups/new
```

### File

```text
src/app/groups/new/page.tsx
```

### Completed

- Created the new-group page.
- Added navigation back to the dashboard.
- Added a group-name input.
- Added initial member-name inputs.
- Added an **Add another member** button.
- Added **Cancel** and **Create group** actions.
- Styled the form consistently with the SPLITMate landing page and dashboard.

### Current Limitation

The form is currently only a frontend interface.

At this stage:

```text
Enter group details
      ↓
Press Create group
      ↓
No database operation yet
```

The goal of the backend work is to change this to:

```text
Enter group details
      ↓
Press Create group
      ↓
Next.js server logic
      ↓
Prisma
      ↓
PostgreSQL
      ↓
Group saved permanently
```

### Error Encountered

When first visiting `/groups/new`, Next.js returned:

```text
The default export is not a React Component in "/groups/new/page"
```

### Resolution

The `page.tsx` file was corrected so it contained a valid default React component export.

The route then loaded successfully.

### Concepts Learned

Every Next.js App Router `page.tsx` must default-export a valid React component.

Example:

```tsx
export default function CreateGroupPage() {
  return (
    <main>
      ...
    </main>
  );
}
```

---

# Backend Foundation

## 2026-09-05 — Backend Architecture Decision

### Objective

Choose how the Next.js application will communicate with the relational database designed during Stage 1.

### Selected Architecture

```text
Next.js
   ↓
Prisma
   ↓
PostgreSQL
```

### Next.js

Provides the application interface and server-side code.

### PostgreSQL

Stores persistent SPLITMate application data.

Planned data includes:

- users;
- groups;
- group memberships;
- expenses;
- expense participants;
- repayments.

### Prisma

Provides the database layer between the TypeScript/Next.js application and PostgreSQL.

Instead of writing raw SQL for every application operation, Prisma allows database operations to be expressed through generated, typed application interfaces.

### Reason for PostgreSQL

SPLITMate contains strongly related data and is already designed as a relational schema.

Examples include:

```text
User → Group Membership
Group → Expenses
Expense → Participants
User → Payments
```

A relational PostgreSQL database is therefore well suited to the project's existing ERD.

---

## 2026-09-05 — Prisma Installation and Initialisation

### Objective

Add Prisma to the existing SPLITMate Next.js application.

### Important Decision

Prisma was added to the **existing** application rather than creating another project.

### Prisma Version

The project is currently using a Prisma 8 release-candidate package:

```text
@prisma/orm-postgres 8.0.0-rc.8
```

This version uses Prisma's newer contract workflow.

### Generated Prisma Structure

```text
src/
└── prisma/
    ├── contract.d.ts
    ├── contract.json
    ├── contract.prisma
    └── db.ts

prisma.config.ts
```

### File Purposes

#### `contract.prisma`

Human-authored description of the application's database models and relationships.

#### `contract.json`

Generated representation of the Prisma data contract.

#### `contract.d.ts`

Generated TypeScript definitions.

#### `db.ts`

Database-related application code generated/configured for the Prisma setup.

#### `prisma.config.ts`

Project-level Prisma configuration.

### Prisma CLI Troubleshooting

An older Prisma command was initially attempted:

```powershell
npx prisma validate
```

Prisma returned:

```text
No command registered for `validate`
```

This revealed that the project was using the newer Prisma 8 CLI rather than the older workflow found in many tutorials.

The CLI also reported that Prisma agent skills needed synchronising.

The following command was run:

```powershell
npx prisma skills sync
```

Result:

```text
Synced 2 skills
```

This synchronised:

```text
prisma-8
prisma-composer
```

### Concepts Learned

- Tooling changes between major versions.
- Documentation for older package versions may contain commands that no longer exist.
- CLI error messages should be used to identify the installed version and correct workflow rather than blindly repeating old commands.

---

## 2026-09-05 — Prisma Postgres Database Creation

### Objective

Create the first real PostgreSQL database for SPLITMate.

### Command

```powershell
npx create-db@latest
```

### Result

A hosted **Prisma Postgres** database was successfully created.

The database was then claimed in the Prisma Console so it would not expire as a temporary database.

### Prisma Console

The Prisma Console now contains:

- one active branch;
- one Prisma Postgres database;
- no deployed application yet;
- no connected Git repository through Prisma.

The Git repository does not currently need to be connected through the Prisma Console because GitHub is already being used separately for project source control.

### Connection String

Prisma generated a PostgreSQL connection string.

The application uses this to determine:

- database host;
- database account;
- credentials;
- database;
- SSL connection settings.

### Security Incident / Lesson

The original database connection string was displayed during development and therefore treated as exposed.

A new connection string was generated/rotated before continuing.

### Security Practice

Database credentials are **never** stored directly in committed application source code.

Instead they are stored in:

```text
.env
```

using:

```env
DATABASE_URL="..."
```

The `.env` file is excluded from Git using `.gitignore`.

### Concepts Learned

Environment variables allow application configuration and secrets to remain separate from source code.

This is important because the GitHub repository should contain:

```text
Application code ✅
Database schema ✅
Documentation ✅
Database password ❌
API secrets ❌
```

---

## 2026-09-05 — Prisma Data Contract Exploration

### Objective

Understand the Prisma starter contract before replacing it with the SPLITMate schema.

### Initial Contract

Prisma initially generated sample `User` and `Post` models.

Example relationship:

```text
User
  1
  │
  *
Post
```

The example demonstrated several Prisma concepts:

- `@id` defines the primary key;
- `@default(autoincrement())` generates sequential IDs;
- `@unique` creates a uniqueness constraint;
- `@relation` creates a relationship between models;
- array relation fields represent one-to-many relationships;
- timestamp fields can use automatic defaults.

### Decision

The demo blogging models were removed because they did not represent SPLITMate.

They were replaced using the database design created during Stage 1.

---

## 2026-09-05 — ERD Converted to Prisma Models

### Objective

Translate the existing SPLITMate relational database design into Prisma's data contract.

### Models Added

```text
User
Group
GroupMember
Expense
ExpenseParticipant
Payment
```

These correspond to the six tables in the documented ERD:

```text
USERS
GROUPS
GROUP_MEMBERS
EXPENSES
EXPENSE_PARTICIPANTS
PAYMENTS
```

---

### User

Stores account-level information.

Core fields:

```text
id
name
email
passwordHash
createdAt
```

Relationships allow a user to:

- create groups;
- belong to groups;
- pay expenses;
- participate in expenses;
- send payments;
- receive payments.

---

### Group

Stores an expense-sharing group.

Core fields:

```text
id
name
description
currency
createdBy
createdAt
```

Relationships connect a group to:

- its creator;
- members;
- expenses;
- payments.

---

### GroupMember

Junction model connecting users and groups.

Core fields:

```text
id
groupId
userId
role
joinedAt
```

Constraint:

```prisma
@@unique([groupId, userId])
```

This prevents the same user being added to one group more than once.

---

### Expense

Stores a shared expense.

Core fields:

```text
id
groupId
description
amount
paidBy
splitMethod
createdAt
```

An expense belongs to one group and identifies the user who originally paid.

---

### ExpenseParticipant

Stores each user's allocated portion of an expense.

Core fields:

```text
id
expenseId
userId
amountOwed
createdAt
```

Constraint:

```prisma
@@unique([expenseId, userId])
```

This prevents duplicate participant records for a user within the same expense.

---

### Payment

Stores repayments between users.

Core fields:

```text
id
groupId
payerId
receiverId
amount
status
createdAt
confirmedAt
```

Payments are intentionally separate from expenses.

An expense represents the original cost.

A payment represents money later transferred between members to settle outstanding balances.

### Multiple Relations to User

Because `Payment` connects to the `User` model twice, named relations are required.

Conceptually:

```text
User → paymentsSent
User → paymentsReceived
```

This distinguishes the payer relationship from the receiver relationship.

---

## 2026-09-05 — Prisma Contract Compilation

### Objective

Confirm that the newly created SPLITMate data contract is valid before creating database tables.

### Command

```powershell
npx prisma contract emit
```

### Result

Prisma successfully resolved and emitted the contract.

Generated files:

```text
src/prisma/contract.json
src/prisma/contract.d.ts
```

Terminal result:

```text
Resolving contract source... complete
Emitting contract... complete
Emitted contract.json and contract.d.ts
```

### Meaning

The ERD has now progressed through:

```text
Database ERD
      ↓
Database documentation
      ↓
Prisma contract
      ↓
Generated Prisma contract files ✅
```

This confirms that Prisma can understand the defined SPLITMate models and relationships.

It does **not yet** mean that the PostgreSQL tables have been created.

---

# Current Database Design

The current SPLITMate schema is based on six entities.

```text
USERS
  │
  ├─────────────┐
  │             │
  ▼             ▼
GROUP_MEMBERS   GROUPS
  │               │
  └───────┬───────┘
          │
          ▼
       EXPENSES
          │
          ▼
EXPENSE_PARTICIPANTS

USERS ───────── PAYMENTS ───────── USERS
          payer            receiver
```

## Key Relationships

| Relationship | Type |
|---|---|
| User → Groups created | One-to-Many |
| User → Group memberships | One-to-Many |
| Group → Group members | One-to-Many |
| Group → Expenses | One-to-Many |
| User → Expenses paid | One-to-Many |
| Expense → Expense participants | One-to-Many |
| User → Expense participation | One-to-Many |
| Group → Payments | One-to-Many |
| User → Payments sent | One-to-Many |
| User → Payments received | One-to-Many |

The `GROUP_MEMBERS` table resolves the many-to-many relationship between users and groups.

The `EXPENSE_PARTICIPANTS` table resolves the many-to-many relationship between users and expenses while also storing each user's allocated amount.

---

# Current Application Structure

At this stage, the important source structure is approximately:

```text
Split-Mate/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── groups/
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   └── prisma/
│       ├── contract.d.ts
│       ├── contract.json
│       ├── contract.prisma
│       └── db.ts
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
├── prisma.config.ts
└── README.md
```

---

# Application Flow So Far

```text
Landing Page
     │
     │ Get started
     ▼
 Dashboard
     │
     │ Create group
     ▼
 /groups/new
```

At present, this is mainly a frontend flow.

The upcoming backend work will make this flow persistent:

```text
/groups/new
     │
     │ Submit form
     ▼
Next.js server logic
     │
     ▼
   Prisma
     │
     ▼
PostgreSQL
     │
     ▼
Saved Group
     │
     ▼
 Dashboard
```

---

# Current Milestone

## Completed

- ✅ Initial project planning
- ✅ System architecture design
- ✅ Database ERD
- ✅ Database design documentation
- ✅ Local development environment
- ✅ Next.js application
- ✅ Git repository
- ✅ GitHub remote repository
- ✅ Landing page
- ✅ Next.js routing
- ✅ Dashboard route
- ✅ Create-group route
- ✅ Prisma added to project
- ✅ Prisma Postgres database created
- ✅ Database claimed
- ✅ Environment-variable configuration
- ✅ Prisma demo models replaced
- ✅ SPLITMate ERD converted to Prisma models
- ✅ Prisma contract successfully emitted

## In Progress

- 🟡 Initialising the actual PostgreSQL database schema from the Prisma contract.

## Not Yet Implemented

- ⬜ Creating real groups
- ⬜ Reading groups from PostgreSQL
- ⬜ Adding real group members
- ⬜ Creating expenses
- ⬜ Splitting expenses
- ⬜ Calculating balances
- ⬜ Recording repayments
- ⬜ Authentication
- ⬜ Protected routes
- ⬜ Input validation
- ⬜ Automated tests
- ⬜ Production deployment
- ⬜ CI/CD
- ⬜ Monitoring/logging

---

# Next Planned Steps

## 1. Initialise the PostgreSQL Schema

Use the Prisma contract to create the real database structure.

Goal:

```text
contract.prisma
      ↓
Database operation
      ↓
PostgreSQL tables
```

After this step, the Prisma database should contain the six SPLITMate tables/models.

---

## 2. Verify the Database

Confirm that the deployed database structure matches the application contract.

Check:

- tables exist;
- primary keys exist;
- foreign-key relationships are correct;
- uniqueness constraints exist;
- field types are correct.

---

## 3. Connect the Create Group Form

Upgrade `/groups/new` from a visual form to a working database operation.

Expected flow:

```text
User enters group
      ↓
Form submission
      ↓
Server-side validation
      ↓
Prisma query
      ↓
INSERT into PostgreSQL
      ↓
Group saved
```

---

## 4. Display Real Groups on Dashboard

Remove hard-coded group examples from the application dashboard.

Replace them with data retrieved from PostgreSQL.

```text
PostgreSQL
      ↓
Prisma query
      ↓
Next.js
      ↓
Dashboard
```

---

## 5. Build the Group Detail Page

Planned route:

```text
/groups/[id]
```

The page should eventually show:

- group name;
- members;
- total expenses;
- recent expenses;
- user balances;
- add-expense action;
- repayment information.

---

## 6. Implement Expenses

Create functionality to:

- add an expense;
- select the payer;
- select participants;
- select split method;
- calculate/store individual shares.

Relevant database models:

```text
Expense
ExpenseParticipant
```

---

## 7. Implement Balance Calculation

Calculate how much each member:

- paid;
- owes;
- is owed.

Balance calculations should be derived from:

```text
Expenses
+ Expense Participants
+ Confirmed Payments
```

rather than storing a separate balance value that could become inconsistent.

---

## 8. Implement Repayments

Allow users to record repayments.

Relevant model:

```text
Payment
```

Planned statuses include:

```text
pending
confirmed
```

A confirmed payment should affect calculated outstanding balances.

---

## 9. Authentication

Once the basic database workflow works, add real user accounts.

Requirements:

- registration;
- login;
- logout;
- password/security handling;
- protected application routes;
- associate groups and expenses with authenticated users.

---

# Later Project Stages

## Stage 3 — Core Application

Main goal:

> Make SPLITMate functional end-to-end.

Features:

- group creation;
- group membership;
- expense creation;
- participant splits;
- balance calculation;
- repayments.

---

## Stage 4 — User Accounts & Permissions

Main goal:

> Make application data belong to real authenticated users.

Features:

- authentication;
- account management;
- route protection;
- group permissions;
- authorisation checks.

---

## Stage 5 — Quality, Testing & Security

Main goal:

> Make SPLITMate reliable rather than simply functional.

Planned work:

- client-side validation;
- server-side validation;
- database validation;
- useful error messages;
- loading states;
- empty states;
- accessibility improvements;
- responsive testing;
- unit tests;
- integration tests;
- security review.

Important business rules include:

```text
USERS.email must be unique

GROUP_MEMBERS(group_id, user_id)
must be unique

EXPENSE_PARTICIPANTS(expense_id, user_id)
must be unique

EXPENSES.amount > 0

EXPENSE_PARTICIPANTS.amount_owed >= 0

PAYMENTS.amount > 0

PAYMENTS.payer_id != PAYMENTS.receiver_id
```

The application must also confirm that users referenced by expenses or payments actually belong to the relevant group.

---

## Stage 6 — Deployment & DevOps

Main goal:

> Move SPLITMate from a local development project to a deployed application with a professional delivery workflow.

Planned topics:

- production hosting;
- production environment variables;
- database deployment;
- CI/CD;
- automated build/testing;
- logging;
- application monitoring;
- error monitoring;
- deployment documentation.

---

# Technical Concepts Learned So Far

## Next.js App Router

Folder structure determines application routes.

Example:

```text
src/app/dashboard/page.tsx
```

becomes:

```text
/dashboard
```

---

## React Components

Pages are React components and must return valid JSX.

Example:

```tsx
export default function Dashboard() {
  return (
    <main>
      <h1>Dashboard</h1>
    </main>
  );
}
```

---

## Git

Git records changes locally.

```text
Working Directory
      ↓
git add
      ↓
Staging Area
      ↓
git commit
      ↓
Local Repository
      ↓
git push
      ↓
GitHub
```

---

## Environment Variables

Secrets and environment-specific configuration should remain separate from source code.

Example:

```env
DATABASE_URL="..."
```

Sensitive environment files must not be committed.

---

## Relational Databases

SPLITMate uses relationships rather than duplicating information.

Examples:

```text
GROUP_MEMBERS
```

connects users and groups.

```text
EXPENSE_PARTICIPANTS
```

connects users and expenses and also stores the amount owed.

---

## Primary Keys

Uniquely identify database records.

Example:

```text
User.id
Group.id
Expense.id
```

---

## Foreign Keys

Connect a record to another table.

Example:

```text
Expense.groupId → Group.id
Expense.paidBy  → User.id
```

---

## Junction Tables

Used to resolve many-to-many relationships.

Examples:

```text
GROUP_MEMBERS
EXPENSE_PARTICIPANTS
```

---

## Prisma

Prisma provides the interface between the application and PostgreSQL.

Current architecture:

```text
Browser
   ↓
Next.js
   ↓
Prisma
   ↓
PostgreSQL
```

---

# Troubleshooting Record

## Git File Displayed as Untracked

### Problem

New files such as:

```text
src/app/dashboard/page.tsx
```

appeared as **untracked** in VS Code.

### Cause

The files existed locally but had not yet been staged with Git.

### Resolution

```powershell
git add .
```

followed by a commit.

---

## Get Started Still Opened `/groups`

### Problem

The landing-page buttons were changed to `/dashboard`, but navigation still opened `/groups`.

### Resolution

Used VS Code project search to find remaining `/groups` references and corrected them.

---

## `/groups/new` Was Not Recognised as a React Component

### Error

```text
The default export is not a React Component in "/groups/new/page"
```

### Cause

The route file did not contain a valid default React component in its current saved state.

### Resolution

Corrected the component structure and default export.

---

## Prisma `validate` Command Failed

### Error

```text
No command registered for `validate`
```

### Cause

The project uses the newer Prisma 8 release-candidate CLI rather than an older Prisma version.

### Resolution

Stopped using outdated commands and worked with the Prisma 8 contract workflow.

Also ran:

```powershell
npx prisma skills sync
```

to synchronise the installed Prisma tooling information.

---

## Database Credentials Were Exposed During Setup

### Problem

The original database connection URL was displayed during development.

### Response

- Treated the credential as compromised.
- Rotated/generated a new connection string.
- Stored the replacement locally using `.env`.
- Ensured `.env` was ignored by Git.

### Lesson

Connection strings, tokens and API keys must be treated as secrets even during development.

---

# Git / Progress Log Routine

For each **meaningful development milestone**:

1. Make the change.
2. Test it locally.
3. Run:

```powershell
git status
```

4. Update this `PROGRESS.md` file.
5. Stage the relevant changes:

```powershell
git add .
```

6. Create a clear commit:

```powershell
git commit -m "Describe the completed change"
```

7. Push it:

```powershell
git push
```

---

# Recommended Commit Style

Commit messages should describe one meaningful completed change.

Examples:

```text
Initialize Next.js application
Build SPLITMate landing page
Add dashboard route
Add create group page
Configure Prisma Postgres database
Define SPLITMate Prisma data contract
Initialize database schema
Connect group creation to database
Load groups on dashboard
Add expense creation flow
Implement balance calculation
Add repayment tracking
```

Avoid unclear messages such as:

```text
update
changes
stuff
fixed things
```

---

# Progress Entry Template

Use the following template for future entries:

```md
## YYYY-MM-DD — Feature / Milestone Name

### Objective

What was the goal of this change?

### Completed

- Change 1
- Change 2
- Change 3

### Technical Details

Explain the main implementation decisions, commands, routes, models or files involved.

### Problems / Troubleshooting

Describe any issue encountered and how it was resolved.

### What I Learned

- Concept 1
- Concept 2

### Next Step

What comes immediately after this?

### Git Commit

`Commit message`
```

---

# Current Next Action

The immediate next task is to initialise and verify the PostgreSQL database using the successfully emitted SPLITMate Prisma contract.

Once that is complete, development can move from **database setup** into the first real **CRUD operation**:

> Creating a group from `/groups/new` and saving it permanently to PostgreSQL.
