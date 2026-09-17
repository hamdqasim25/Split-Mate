## Development Roadmap

### Implementation and testing notes — 17 September 2026

This roadmap update was added during implementation and testing. It reflects the current code and contract; the original stage list is preserved below as historical planning.

| Milestone | Current status | Evidence or remaining work |
| --- | --- | --- |
| Project and UI foundation | Implemented | Next.js app with landing, dashboard and group-creation pages; dashboard/form remain static |
| Database foundation and guest-member redesign | Implemented in the contract and migration history | Eight models; latest migration is recorded as applied and verified before this work |
| Transactional group-creation service | Implemented and unit tested | Creates group, secure token, owner, guests and activity together; internal service only |
| Owner authentication | Next | Registration, password verification and secure owner sessions |
| Authenticated creation boundary | Pending | Verify owner session; validate requests; handle errors, request origin and duplicate submissions |
| Form and dashboard integration | Pending | Submit the form and display the owner's persisted groups |
| End-to-end group creation verification | Pending | Exercise authenticated creation against a designated test database and check real rollback |
| Shared group access | Planned | Resolve enabled share tokens at `/g/[shareToken]` |
| Guest identity | Planned | Claim existing names, hashed guest-session tokens, expiry and secure cookies |
| Activity feed | Planned | Display recorded events; GROUP_CREATED is already written by the service |
| Expenses and balances | Planned | GroupMember-based participants, Decimal amounts and explicit rounding |
| Repayments | Planned | SENT followed by receiver CONFIRMED |
| Account linking and owner controls | Planned | Optional guest accounts, member management and share-link regeneration/disable |

The immediate product milestone remains **end-to-end group creation**. The backend service is complete for its current scope; authentication, delivery through the UI and live integration verification still need work.

During implementation, 32 unit tests, TypeScript, targeted lint and the production build passed. Repository-wide lint has existing generated/tooling findings. See the [progress report](progress-report.md) for the verification limits.

---

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


### Stage 1 — Planning ✅
- Define problem
- Define project requirements
- Define core features

### Stage 2 — System Design ✅
- Application architecture
- Database ERD
- Database documentation

### Stage 3 — Application Setup ✅
- Create Git repository
- Initialise Next.js
- Build initial UI structure

### Stage 4 — Database Implementation 🚧
- Create database
- Write SQL schema
- Create tables
- Define primary keys
- Define foreign keys
- Add constraints
- Test relationships

### Stage 5 — Backend Integration
- Connect Next.js to database
- Implement database queries
- Create API/backend logic

### Stage 6 — Core Features
- Users
- Groups
- Expenses
- Expense splitting
- Payments
