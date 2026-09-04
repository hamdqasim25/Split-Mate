# SplitMate Database Design

## Overview

SplitMate uses a relational database to store and manage information about users, groups, expenses, expense participants, and repayments.

The database is designed using PostgreSQL and uses primary keys and foreign keys to maintain relationships between different entities.

The main objectives of the database design are to:

* Store user and group information
* Track which users belong to each group
* Record expenses and who paid for them
* Track how individual expenses are split between participants
* Record repayments between users
* Maintain data integrity through relationships and constraints

## Entity Relationship Diagram

![SplitMate Database ERD](database-erd.png)

The editable version of the ERD is available as `database-erd.drawio`.

## Database Structure

The initial database consists of six main tables:

### 1. USERS

Stores information about registered SplitMate users.

| Column          | Description                           |
| --------------- | ------------------------------------- |
| `id`            | Primary key identifying the user      |
| `name`          | User's display name                   |
| `email`         | User's email address                  |
| `password_hash` | Securely stored password hash         |
| `created_at`    | Date and time the account was created |

Each user can belong to multiple groups and can be involved in multiple expenses and payments.

### 2. GROUPS

Stores information about groups created within SplitMate.

| Column        | Description                         |
| ------------- | ----------------------------------- |
| `id`          | Primary key identifying the group   |
| `name`        | Name of the group                   |
| `description` | Optional description of the group   |
| `currency`    | Default currency used by the group  |
| `created_by`  | Foreign key referencing `USERS.id`  |
| `created_at`  | Date and time the group was created |

A group can contain multiple users and multiple expenses.

### 3. GROUP_MEMBERS

Connects users to groups.

| Column      | Description                            |
| ----------- | -------------------------------------- |
| `id`        | Primary key identifying the membership |
| `group_id`  | Foreign key referencing `GROUPS.id`    |
| `user_id`   | Foreign key referencing `USERS.id`     |
| `role`      | User's role within the group           |
| `joined_at` | Date and time the user joined          |

This table is required because users and groups have a **many-to-many relationship**.

A user can belong to multiple groups, while a group can contain multiple users.

### 4. EXPENSES

Stores individual expenses recorded within a group.

| Column         | Description                           |
| -------------- | ------------------------------------- |
| `id`           | Primary key identifying the expense   |
| `group_id`     | Foreign key referencing `GROUPS.id`   |
| `description`  | Description of the expense            |
| `amount`       | Total cost of the expense             |
| `paid_by`      | Foreign key referencing `USERS.id`    |
| `split_method` | Method used to divide the expense     |
| `created_at`   | Date and time the expense was created |

For example, if Hamdi pays £60 for a meal for four people, the expense is recorded once in `EXPENSES`, 
while the individual amounts owed by each participant are stored separately.

### 5. EXPENSE_PARTICIPANTS

Stores which users participated in an expense and how much each participant owes.

| Column        | Description                                      |
| ------------- | ------------------------------------------------ |
| `id`          | Primary key identifying the participation record |
| `expense_id`  | Foreign key referencing `EXPENSES.id`            |
| `user_id`     | Foreign key referencing `USERS.id`               |
| `amount_owed` | Amount owed by the participant                   |

This table allows SplitMate to support both equal and unequal expense splitting.

For example:

An expense of £60 could be split equally between three users:

* User A → £20
* User B → £20
* User C → £20

Alternatively, users could owe different amounts depending on what they consumed or agreed to pay.

### 6. PAYMENTS

Stores repayments made between users.

| Column         | Description                             |
| -------------- | --------------------------------------- |
| `id`           | Primary key identifying the payment     |
| `group_id`     | Foreign key referencing `GROUPS.id`     |
| `payer_id`     | Foreign key referencing `USERS.id`      |
| `receiver_id`  | Foreign key referencing `USERS.id`      |
| `amount`       | Amount being repaid                     |
| `status`       | Current payment status                  |
| `created_at`   | Date and time the payment was recorded  |
| `confirmed_at` | Date and time the payment was confirmed |

Both `payer_id` and `receiver_id` reference the `USERS` table.

This is because a payment involves two users.

For example:

**Ahmed → Hamdi: £30**

Ahmed would be stored as the `payer_id`, while Hamdi would be stored as the `receiver_id`.

## Key Relationships

### Users and Groups

Users and groups have a **many-to-many relationship**.

A user can belong to many groups, and each group can contain many users.

This relationship is handled through the `GROUP_MEMBERS` table.

```text
USERS
  │
  │
  ▼
GROUP_MEMBERS
  ▲
  │
  │
GROUPS
```

### Groups and Expenses

A group can contain many expenses, while each expense belongs to one group.

```text
GROUPS 1 ─────────── * EXPENSES
```

### Expenses and Participants

An expense can have multiple participants, and a user can participate in multiple expenses.

The `EXPENSE_PARTICIPANTS` table manages this relationship.

```text
EXPENSES 1 ─────────── * EXPENSE_PARTICIPANTS
USERS   1 ─────────── * EXPENSE_PARTICIPANTS
```

### Users and Payments

A payment connects two users: the person making the repayment and the person receiving it.

```text
USERS
  │
  ├──── payer_id ──────► PAYMENTS
  │
  └──── receiver_id ───► PAYMENTS
```

The same `USERS` table is therefore referenced twice by `PAYMENTS`.

## Primary Keys and Foreign Keys

Each table contains a primary key (`id`) used to uniquely identify each record.

Foreign keys are used to create relationships between tables.

For example:

```text
EXPENSES.group_id → GROUPS.id
EXPENSES.paid_by  → USERS.id
```

This ensures that an expense can be associated with an existing group and user.

## Data Integrity

The database will use constraints to help maintain valid data.

Examples include:

* Primary keys must be unique.
* Foreign keys must reference existing records.
* User email addresses should be unique.
* Expense amounts must be greater than zero.
* Payment amounts must be greater than zero.
* An expense participant should belong to the relevant group.
* A payment should involve valid users within the relevant group.

Additional constraints will be introduced during implementation as the application requirements become clearer.

## Future Considerations

The initial database design provides the foundation for the SplitMate MVP. As development progresses, 
additional functionality may require changes to the schema.

Potential future additions include:

* Partial repayments
* Payment confirmation and cancellation
* Receipt storage
* Multiple currencies
* Notifications and reminders
* Recurring expenses
* Expense categories
* Settlement optimisation
* Audit history
* Payment provider integration

The ERD and database documentation will be updated as the system evolves.

## Design Approach

The database is intentionally being designed before implementation. 
This allows the relationships between users, groups, expenses and payments to be considered before creating the actual PostgreSQL schema.

The final database structure may change during development if new requirements or technical considerations are identified.
