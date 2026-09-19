# SPLITMate User Stories

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed

- As an owner, I can register, log in and use a database-backed session to reach protected owner pages. A POST logout endpoint revokes my session.
- As an authenticated owner, I can create a group with named guests through the form. The server establishes ownership from my session, creates my claimed OWNER membership, unclaimed guest memberships and the creation event atomically.
- As an owner, I receive validation feedback for invalid or duplicate names instead of ambiguous member identities.
- As an owner, I can see my name, persisted groups, active member counts and recent group activity on the dashboard. Money summaries clearly remain unavailable until the expense workflow exists.
- As a guest, I can already be represented by a GroupMember with no linked User account. Accessing or claiming that identity is still planned.

The creation journey was live-tested against Prisma cloud PostgreSQL. Dashboard reads were verified read-only; automated tests use local mocks. See [progress](progress-report.md).

### Next

- As an owner, I want to open my group from a dashboard card and see its members and activity.
- As an owner, I want to copy, disable or regenerate the reusable share link.
- As a guest, I want to open `/g/[shareToken]`, select my existing name and be remembered securely through a separate GuestSession without registering.

These follow the ordered [roadmap](dev-roadmap.md); shared access is not implemented merely because a token exists.

### Future

- As a member, I want to record expenses, allocate shares and see accurate balances using my GroupMember identity.
- As a payer, I want to mark a repayment SENT; as its receiver, I want to mark it CONFIRMED after receipt.
- As a guest, I want optional account linking without a duplicate identity or lost history.

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


## Group Management

As a user,
I want to create a group,
so that I can manage shared expenses with my friends.

## Adding Expenses

As a group member,
I want to record an expense,
so that everyone knows how much they owe.

## Balance Tracking

As a user,
I want to see my current balance,
so that I know whether I owe money or am owed money.

## Settlement

As a group member,
I want the application to calculate who should pay whom,
so that the group can settle expenses efficiently.

</details>
