# SPLITMate User Stories

## Completed

- As an owner, I can register, sign in and sign out using a database-backed session.
- As an owner, I can create a group with distinct guest names and see it on my persisted dashboard.
- As an owner, I can open my group, view members/recent activity and copy its reusable invite.
- As a guest, I can select my existing unclaimed name through an enabled invite without registering.
- As a returning guest, I can enter my group's protected page using my valid browser session.
- As a guest, I can see my identity, joined/waiting active members and recent group activity.
- As an existing guest, I retain access when invitations are disabled, provided my session and membership remain valid.
- As a guest, I can sign out on this device; my membership remains claimed and my owner login, if any, is unaffected.

## Next: Expense creation and splitting

As a group member, I want to record who paid and who participated, with shares that add up exactly to the expense amount.

## Future

- View balances and record repayments with receiver confirmation.
- Recover guest access or link an optional account without losing history.
- Manage members and disable/regenerate invitations through owner controls.

See [requirements](requirements.md), [architecture](architecture.md) and [testing evidence](tests.md). The sign-out UI explains that claimed identities cannot currently be recovered on that device.

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
