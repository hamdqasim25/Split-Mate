# SPLITMate Requirements

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed

| Requirement | Implemented behaviour |
| --- | --- |
| Owner accounts | Register/login/logout, password hashing and database-backed UserSession |
| Protected owner pages | Direct server guards on dashboard and group creation |
| Trusted ownership | API and dashboard derive User.id from the verified server session |
| Group creation | Form and endpoint call the transactional service; owner/guest identities, token and activity are created together |
| Guest-compatible identity | GroupMember.userId is nullable; guests need no account to be represented in a group |
| Owner overview | Real groups, active member counts and recent owned-group activity; useful empty states |
| Safe output | No shareToken, password hash or session token in dashboard data; no invented balances |
| Validation | GBP, 1-100 character names, optional description up to 1000 characters, 0-50 guests, distinct normalized names |

Registration requires at least 15 characters and at most 72 UTF-8 password bytes. Emails are consistently trimmed/lowercased. Login failures are generic. Mutations validate origin; group creation accepts JSON with a bounded body. Ordinary duplicate clicks are inhibited while pending; server-side idempotency is not implemented.

### Next

Owner detail and card navigation, member/activity display and share-link controls precede public `/g/[shareToken]` and guest claiming. Guest claiming must choose an existing owner-defined GroupMember and use a separate hashed, expiring GuestSession. It must not require a User account or trust a browser-supplied member ID as proof of identity.

### Future

Expenses, balances and repayments must reference GroupMember, use group currency and deterministic Decimal rounding, and enforce same-group references server-side. Repayment completion requires receiver confirmation after the sender marks SENT. Optional guest registration must link the existing identity, preserving history.

Rate limiting is required before public deployment. Further production hardening and live rollback integration tests remain separate work. See [progress](progress-report.md) for tested scope and [roadmap](dev-roadmap.md) for ordering.

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
