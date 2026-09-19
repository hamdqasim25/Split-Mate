# SPLITMate Requirements

## Implemented

| Area | Requirement satisfied |
| --- | --- |
| Owner accounts | Registration/login/sign-out with hashed passwords and UserSession |
| Owner group access | Session-derived ownership for creation, dashboard and group detail |
| Group creation | Group, secure share token, owner/guest members and GROUP_CREATED created atomically |
| Guest identity | Nullable GroupMember.userId; existing named members can claim without accounts |
| Invite validation | Canonical token, enabled sharing and eligible same-group member required for new claims |
| Guest authentication | Hashed expiring GuestSession; URL/member IDs alone never authenticate |
| Protected guest page | Current identity, active joined/waiting members, latest 10 allowed events |
| Access policy | Disabled invitations stop new claims; existing valid guests retain access |
| Activity tracking | Throttled lastSeenAt/lastActiveAt updates without extending expiry |
| Guest sign-out | Revoke browser guest session; preserve membership, claimedAt and owner login |
| Safe presentation | No private account/session data or invented financial balances |

Group input supports GBP, 1–100-character normalized distinct names, optional description up to 1000 characters and 0–50 guests. Owner/member and token validation remains server-side. See [architecture](architecture.md) for authentication details and [tests](tests.md) for verification scope.

## Next: Expense creation and splitting

Financial records must reference GroupMember, enforce same-group participants/payer, use group currency and deterministic money handling, and preserve totals after rounding. Expense creation must log activity atomically.

## Future requirements and limits

Balances and repayments must preserve sender SENT / receiver CONFIRMED. Optional accounts must link existing memberships and history. Rate limiting is required before public deployment; server-side idempotency, guest recovery and multi-group guest-session management are not implemented.

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


## Functional Requirements

FR1 - Users must be able to create an account.

FR2 - Users must be able to create a group.

FR3 - Users must be able to invite other users.

FR4 - Users must be able to add shared expenses.

FR5 - Users must be able to specify who paid.

FR6 - Users must be able to specify who participated.

FR7 - The system must calculate each participant's share.

FR8 - The system must calculate outstanding balances.

FR9 - Users must be able to record repayments.

FR10 - The system must log each event so users can see all changes.

</details>
