# Database Design

## Overview

SPLITMate uses a relational database to store users, groups, shared expenses, expense participants, and payments between users.

The database is designed so that:

- users can belong to multiple groups;
- groups can contain multiple users;
- expenses belong to a group and record who originally paid;
- each expense can be split between multiple participants;
- the amount owed by each participant can be stored individually;
- repayments between users can be recorded and tracked separately from expenses.

This structure keeps the data normalised and separates the original expense from the later payments used to settle balances.

---

## Entity Relationship Diagram

![SPLITMate Database ERD](./images/database-erd.png)

The ERD contains six main tables:

1. `USERS`
2. `GROUPS`
3. `GROUP_MEMBERS`
4. `EXPENSES`
5. `EXPENSE_PARTICIPANTS`
6. `PAYMENTS`

---

## Tables

### USERS

Stores account information for each SPLITMate user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique identifier for the user |
| `name` | String | Not Null | User's display name |
| `email` | String | Unique, Not Null | User's email address |
| `password_hash` | String | Not Null | Securely hashed password |
| `created_at` | Timestamp | Not Null | Date and time the account was created |

A user can create groups, join multiple groups, pay for expenses, participate in expenses, and send or receive payments.

---

### GROUPS

Stores information about each expense-sharing group.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique identifier for the group |
| `name` | String | Not Null | Name of the group |
| `description` | String / Text | Nullable | Optional description of the group |
| `currency` | String | Not Null | Currency used by the group, such as GBP |
| `created_by` | Integer / UUID | Foreign Key → `USERS.id` | User who created the group |
| `created_at` | Timestamp | Not Null | Date and time the group was created |

One user can create multiple groups, while each group has one creator.

---

### GROUP_MEMBERS

Junction table used to represent the many-to-many relationship between users and groups.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique membership record |
| `group_id` | Integer / UUID | Foreign Key → `GROUPS.id` | Group the user belongs to |
| `user_id` | Integer / UUID | Foreign Key → `USERS.id` | User who belongs to the group |
| `role` | String / Enum | Not Null | User's role within the group, for example `admin` or `member` |
| `joined_at` | Timestamp | Not Null | Date and time the user joined the group |

Recommended constraint:

```sql
UNIQUE (group_id, user_id)
```

This prevents the same user from being added to the same group more than once.

---

### EXPENSES

Stores expenses created inside a group.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique identifier for the expense |
| `group_id` | Integer / UUID | Foreign Key → `GROUPS.id` | Group the expense belongs to |
| `description` | String / Text | Not Null | Description of the expense |
| `amount` | Decimal | Not Null | Total value of the expense |
| `paid_by` | Integer / UUID | Foreign Key → `USERS.id` | User who originally paid the expense |
| `split_method` | String / Enum | Not Null | Method used to split the expense, such as `equal` or `custom` |
| `created_at` | Timestamp | Not Null | Date and time the expense was created |

A group can contain many expenses, but each expense belongs to one group.

The `paid_by` field records the person who initially covered the cost. The amount owed by each participant is stored separately in `EXPENSE_PARTICIPANTS`.

---

### EXPENSE_PARTICIPANTS

Stores the users included in each expense and the amount each person owes.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique participant record |
| `expense_id` | Integer / UUID | Foreign Key → `EXPENSES.id` | Expense being split |
| `user_id` | Integer / UUID | Foreign Key → `USERS.id` | User included in the expense |
| `amount_owed` | Decimal | Not Null | Amount allocated to the user |
| `created_at` | Timestamp | Not Null | Date and time the participant record was created |

Recommended constraint:

```sql
UNIQUE (expense_id, user_id)
```

This ensures a user only appears once within a particular expense split.

This table also allows SPLITMate to support different splitting methods without changing the main `EXPENSES` table. For example, an expense can be divided equally or each participant can be assigned a custom amount.

---

### PAYMENTS

Stores repayments made between members of a group.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | Integer / UUID | Primary Key | Unique identifier for the payment |
| `group_id` | Integer / UUID | Foreign Key → `GROUPS.id` | Group in which the repayment was made |
| `payer_id` | Integer / UUID | Foreign Key → `USERS.id` | User sending the payment |
| `receiver_id` | Integer / UUID | Foreign Key → `USERS.id` | User receiving the payment |
| `amount` | Decimal | Not Null | Amount being repaid |
| `status` | String / Enum | Not Null | Current payment state, for example `pending` or `confirmed` |
| `created_at` | Timestamp | Not Null | Date and time the payment was recorded |
| `confirmed_at` | Timestamp | Nullable | Date and time the payment was confirmed |

Payments are deliberately kept separate from expenses. An expense records who originally paid for something, while a payment represents money later transferred between users to settle an outstanding balance.

Useful validation rules include:

- `payer_id` must not equal `receiver_id`;
- `amount` must be greater than zero;
- both users should be members of the group referenced by `group_id`;
- `confirmed_at` should remain `NULL` until the payment is confirmed.

---

## Relationships

The main relationships in the database are:

| Relationship | Cardinality | Description |
|---|---|---|
| `USERS` → `GROUPS` | One-to-Many | One user can create multiple groups |
| `USERS` → `GROUP_MEMBERS` | One-to-Many | One user can have memberships in multiple groups |
| `GROUPS` → `GROUP_MEMBERS` | One-to-Many | One group can contain multiple members |
| `GROUPS` → `EXPENSES` | One-to-Many | One group can contain multiple expenses |
| `USERS` → `EXPENSES` | One-to-Many | One user can pay for multiple expenses |
| `EXPENSES` → `EXPENSE_PARTICIPANTS` | One-to-Many | One expense can contain multiple participants |
| `USERS` → `EXPENSE_PARTICIPANTS` | One-to-Many | One user can participate in multiple expenses |
| `GROUPS` → `PAYMENTS` | One-to-Many | One group can contain multiple repayment records |
| `USERS` → `PAYMENTS` (`payer_id`) | One-to-Many | One user can send multiple payments |
| `USERS` → `PAYMENTS` (`receiver_id`) | One-to-Many | One user can receive multiple payments |

The `GROUP_MEMBERS` table resolves the many-to-many relationship between `USERS` and `GROUPS`, while `EXPENSE_PARTICIPANTS` resolves the many-to-many relationship between `USERS` and `EXPENSES`.

---

## Example Data Flow

A typical SPLITMate transaction could work as follows:

1. A user creates a group.
2. Other users are added through `GROUP_MEMBERS`.
3. One member pays for a shared activity and creates an `EXPENSES` record.
4. Each person included in the expense receives an `EXPENSE_PARTICIPANTS` record containing their individual `amount_owed`.
5. SPLITMate calculates balances from the expense and participant records.
6. When one user repays another, a `PAYMENTS` record is created.
7. The repayment can initially have a `pending` status and later be changed to `confirmed`, with `confirmed_at` recording when this happened.
8. Confirmed payments are included when calculating the group's outstanding balances.

---

## Design Decisions

### Separate expenses and repayments

Expenses and repayments represent different events and are therefore stored separately. This avoids changing historical expense records whenever users settle their balances.

### Junction tables for many-to-many relationships

`GROUP_MEMBERS` and `EXPENSE_PARTICIPANTS` prevent repeated data and make the database easier to extend. They also allow additional information to be stored about the relationship itself, such as a member's `role` or a participant's `amount_owed`.

### Group-level currency

Currency is stored on the `GROUPS` table so all expenses and repayments within a group use the same currency. This simplifies balance calculations for the first version of SPLITMate.

### Payment confirmation

The `status` and `confirmed_at` fields allow SPLITMate to distinguish between a payment that has been claimed and one that has actually been confirmed. This helps prevent balances from being changed prematurely.

---

## Integrity and Validation

In addition to foreign keys, the application/database should enforce several constraints:

```text
USERS.email                      must be unique
GROUP_MEMBERS(group_id,user_id)  must be unique
EXPENSE_PARTICIPANTS(expense_id,user_id) must be unique
EXPENSES.amount                  must be > 0
EXPENSE_PARTICIPANTS.amount_owed must be >= 0
PAYMENTS.amount                  must be > 0
PAYMENTS.payer_id                must not equal PAYMENTS.receiver_id
```

At application level, SPLITMate should also verify that users referenced by an expense or payment are members of the relevant group.

---

## Future Improvements

The current schema is intentionally focused on the first version of SPLITMate. Possible later additions include:

- group invitations;
- expense categories;
- receipts or image attachments;
- comments or notes;
- payment methods;
- notifications;
- audit/history records;
- support for multiple currencies and exchange rates.

These features can be added later without significantly changing the core database structure.
