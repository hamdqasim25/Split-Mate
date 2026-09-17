# Requirements

## Implementation and testing notes — 17 September 2026

These clarifications were added during implementation and testing to align the requirements with the guest-member design. The original requirement list is preserved below. A database model's existence does not mean its product workflow is implemented.

| Requirement | Current scope and status |
| --- | --- |
| Owner accounts | The group creator must have an authenticated User account. User storage exists; registration, login and sessions are pending. |
| Group creation | An internal service atomically creates the group, secure share token, owner GroupMember, supplied guest GroupMembers and GROUP_CREATED event. HTTP/UI integration remains pending. |
| Guest participation | Guests must be able to participate without an account. Nullable GroupMember user links exist; shared access and claiming are pending. |
| Shared access | Use a cryptographically random reusable token, with planned disable/regeneration controls. Token generation is implemented; public access and controls are pending. |
| Member claiming | Guests select an existing owner-defined identity. Verify a hashed, expiring GuestSession token on subsequent requests. Storage exists; the flow is pending. |
| Financial identity | Expenses, participants and repayment endpoints reference GroupMember IDs. Contract implemented; request handlers must later enforce same-group membership. |
| Money and currency | Use the group's currency and Decimal amounts with explicit rounding. Group creation currently permits GBP; splitting and balance calculations are pending. |
| Repayments | A payer marks SENT and the receiver confirms CONFIRMED. Contract fields exist; workflow pending. |
| Activity history | Important mutations should record structured activity, atomically where appropriate. GROUP_CREATED is implemented; the feed and other actions are pending. |
| Optional accounts | A guest may later link an account to the existing GroupMember without losing history. Pending. |

### Validation and security acceptance criteria

The implemented service accepts a name of 1–100 characters, an optional description up to 1000 characters, GBP and 0–50 guest names. It trims names, collapses whitespace, rejects blank or duplicate names and rejects unsupported input fields. The owner identity comes from a server-side caller and must originate in a verified session.

Before public submission is implemented, the boundary must authenticate the owner, protect against cross-site requests, handle duplicate submissions and translate internal errors into safe responses. The current service does not authenticate callers or provide idempotency.

During implementation, unit tests verified validation, record identities and failure propagation using a database double. Live transaction rollback and end-to-end authentication remain acceptance checks for the integration milestone. See [the progress report](progress-report.md).

---

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
