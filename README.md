# SplitMate

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
