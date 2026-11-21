# SPLITMate Development Roadmap

This is the single source for feature status, limitations and future work. Completed implementation does not imply comprehensive browser, accessibility or live-database verification. Checklists distinguish delivered work from outstanding checks; dated results are recorded evidence, not checks rerun for this roadmap.

Only owners need accounts. Guests participate through existing group-member identities, and financial history remains attached to those identities. SPLITMate records payments completed externally; it does not process money transfers. The website is currently local-only, with no deployment commitment or target date.

See [architecture](architecture.md) for behaviour, [database design](database-design.md) for schema and migration evidence, and [testing](tests.md) for verification scope and remaining scenarios.

## Milestone overview

| Phase | Milestone | Status |
| --- | --- | --- |
| 1 | Foundation and Owner Authentication | Complete |
| 2 | Groups and Guest Participation | Complete |
| 3 | Expenses and Balances | Complete |
| 4 | Repayments and Reconciliation | Complete |
| 5 | Expense Management and Data Integrity | Browser checks outstanding |
| 6 | UI/UX and Accessibility | In progress |
| 7 | Testing, CI and Presentation | Complete within recorded verification scope |
| 8 | Profile and Account Settings | In progress: read-only profile implemented |
| 9 | Security and Release Readiness | Planned |

Phases 1–4 describe completed implementation milestones within the recorded verification scope. Outstanding cross-cutting checks remain explicit in phases 5, 6 and 9. Phase 7's optional screenshot enhancement does not imply missing test or CI implementation.

## Phase 1 — Foundation and Owner Authentication

**Status:** Complete

**Goal:** Establish the application, persistence and secure owner access.

- [x] Next.js App Router, React, TypeScript and Tailwind foundation.
- [x] PostgreSQL integration through the pinned Prisma 8 RC contract workflow.
- [x] Owner registration with secure bcrypt password hashing.
- [x] Login, logout and hashed, database-backed owner sessions with expiry and revocation.
- [x] Server-side owner authentication and authorization boundaries.

**Outcome:** Owners can securely access their account and groups.

## Phase 2 — Group Creation and Guest Participation

**Status:** Complete

**Goal:** Let owners create groups and guests participate without registration.

- [x] Atomic group creation with owner membership, named guests and creation activity.
- [x] Cryptographically secure reusable invitation links generated on the server.
- [x] Claims restricted to eligible existing names, with competing-claim protection.
- [x] Separate hashed guest sessions, expiry checks, protected access and device sign-out.
- [x] Guest participation without an account; financial records reference GroupMember.
- [x] Persisted owner dashboard, active membership information and joined/waiting states.

**Outcome:** Owners and guests can enter a shared group with distinct, validated identities.

## Phase 3 — Expense Splitting and Balance Calculations

**Status:** Complete

**Goal:** Record exact shares and explain each member's balance.

- [x] Owner and guest expense creation with payer and participant selection.
- [x] Deterministic equal splitting in integer pennies and custom monetary shares.
- [x] Review before saving, server validation and same-group membership checks.
- [x] Atomic persistence of expenses, participant shares and activity.
- [x] Complete-ledger balances and separate owner owed/owing dashboard totals.
- [x] Historical inactive-member effects and effective confirmed repayment allocations.
- [x] Explicit unavailable balances for inconsistent or unresolved financial records.

**Outcome:** Saved shares add up exactly, and balances reflect the complete supported financial history.

## Phase 4 — Repayments and Reconciliation

**Status:** Complete

**Goal:** Track external repayments with accountable owner review.

- [x] Guests report their own transfers as SENT without settling their debts unilaterally.
- [x] Owners confirm or reject reports, including transfers between other members.
- [x] Owners directly record verified completed external payments.
- [x] Expense allocations determine effective confirmed balance effects.
- [x] Pending reservations protect debt and credit capacity; rejected reports have no balance effect.
- [x] Request keys, matching retries and repeated review decisions prevent duplicate effects.
- [x] Evidence-based historical reconciliation with stale-version checks and frozen exclusions.
- [x] Review timestamps, audit fields and activity retained with financial changes.

**Outcome:** Only effective confirmed allocations change balances; SPLITMate neither transfers money nor verifies bank transfers.

## Phase 5 — Expense Management and Data Integrity

**Status:** Implementation complete; browser verification outstanding

**Goal:** Manage saved expenses without silently losing financial history.

- [x] Owner-only expense editing with exact custom shares and historical-member safeguards.
- [x] Stale-form protection prevents overwriting or deleting a newer version.
- [x] Expense soft deletion preserves history and excludes only linked payment allocations.
- [x] Explicitly confirmed permanent group deletion removes dependent history/access while preserving other groups and accounts.
- [x] Expense request identities persist through review, edits to drafts and uncertain retries.
- [x] Matching retries return the original expense after saved edits or deletion; conflicting request-key reuse is rejected.
- [x] Expense-request migration applied to the configured database on 27 October 2026; independent status, schema and full marker verification recorded on 28 October 2026.
- [x] Complete manual owner/guest expense retry scenarios: review/back/edit, validation, committed-response loss and same-key retry, conflicting reuse and fresh keys.

**Outcome:** Implementation and recorded database checks are complete; browser retry verification remains open.

## Phase 6 — UI/UX and Accessibility

**Status:** In progress

**Goal:** Keep group screens compact, readable and usable across devices.

- [x] Shared light/dark preference with device fallback and local persistence.
- [x] Accessible native 44px theme control and compatibility fallbacks implemented.
- [x] Compact balance/member cards with expandable breakdowns that retain form drafts.
- [x] Streamlined payment history and simplified recent-activity summaries.
- [x] Consistent GBP display and Europe/London timestamps, including daylight saving.
- [x] Independent expandable payment/activity details preserve original records and owner controls.
- [ ] Verify mobile 360px/390px and desktop layouts in both themes, including long names and large amounts.
- [ ] Verify keyboard navigation, disclosure activation and visible focus.
- [ ] Verify screen-reader labels, announcements and expanded states.
- [ ] Complete accessibility, zoom, overflow, touch-target and reduced-motion checks.

**Outcome:** Presentation improvements are implemented; real-browser usability and accessibility checks remain outstanding.

## Phase 7 — Testing, CI and Project Presentation

**Status:** Implementation milestone complete within recorded verification scope

**Goal:** Make verification reproducible and project evidence easy to understand.

- [x] Automated isolated unit/regression tests and guarded PostgreSQL integration tests implemented.
- [x] Recorded 670 passing isolated tests on 18 November 2026, with lint, TypeScript and build checks.
- [x] Recorded 26 passing local PostgreSQL integration tests on 15 November 2026; initial migration rehearsal recorded on 25 October.
- [x] GitHub Actions CI covers isolated tests, lint, TypeScript, build and disposable PostgreSQL tests.
- [x] Successful hosted CI run completed on 15 November 2026, independently confirmed on 18 November.
- [x] README CI badge and SPLITMate browser title/description added.
- [x] README product, setup and source-navigation improvements delivered.
- [x] Architecture, database, testing and roadmap documentation maintained with distinct responsibilities.
- [ ] Add authentic application screenshots to the README as a future presentation enhancement.

**Outcome:** Automated verification and project presentation are established; historical results do not prove every browser journey or current environment.

## Phase 8 — Profile and Account Settings

**Status:** In progress: Phase 8.2 implemented; browser checks outstanding

**Goal:** Give registered owners a clear, secure place to manage supported account settings.

- [x] Review existing authentication and account architecture before designing changes.
- [x] Implement a responsive, read-only owner profile page at `/profile`.
- [x] Display the authenticated owner's name and email with server-side privacy checks.
- [x] Add a global session-aware account disclosure: owner Profile/Appearance/sign out, guest Register-first and signed-out Log-in-first navigation.
- [x] Make shared logo/name branding one accessible home link and remove duplicate landing navigation.
- [x] Provide a protected Appearance page and icon-only theme control using existing persistence.
- [x] Retain an exact login/register return allowlist for profile and appearance.
- [ ] Implement secure password changes.
- [x] Organize profile and appearance navigation into dedicated pages.
- [ ] Complete security navigation and remaining Phase 8.4 settings work.
- [x] Add profile authorization, privacy and return-navigation regression tests.
- [ ] Add authorization and regression tests for password management and later settings.
- [ ] Complete browser and accessibility verification.

**Outcome:** Owners can view account details, manage appearance and sign out through compact header navigation. Profile editing, Phase 8.3 password management and remaining Phase 8.4 work are not complete; browser verification remains outstanding.

## Phase 9 — Security Hardening and Release Verification

**Status:** Planned

**Goal:** Close security and verification gaps before any future public release.

- [ ] Define and implement server-side authentication rate limiting for registration and login.
- [ ] Implement guest-claim rate limiting and verify endpoint-level enforcement.
- [ ] Provide safe, useful retry feedback for limited attempts.
- [ ] Complete remaining browser and authentication checks, including owner/guest access, deletion, reconciliation and retry journeys.
- [ ] Verify database status, schema and contract marker separately for each intended environment.
- [ ] Verify production session and HTTPS cookie behaviour in an appropriate environment.
- [ ] Complete the outstanding accessibility review.
- [ ] Review release readiness against the remaining checks in tests.md.

**Outcome:** Intended to establish evidence for a future release; the website remains local-only and deployment is not scheduled.

## Current Limitations and Constraints

| Limitation | Current consequence |
| --- | --- |
| Group creation lacks durable retry identities | Separate successful requests can create duplicate groups after a lost response |
| One guest identity per browser; no recovery or identity-switching interface | Signing out, losing or expiring a guest cookie leaves the member claimed without a recovery flow |
| Historical payments may not fit expense-association rules | Unresolved confirmed payments make balances unavailable; pending/confirmed unassociated payments block deletion and financial edits; old netted transfers or permanently removed expenses need a separately reviewed recovery approach |
| GBP only, equal/custom splitting | Percentage splits, other currencies and exchange-rate conversion are unavailable |
| Owner review is the current payment authority | Guest recipients cannot confirm; terminal payment statuses cannot be reversed |
| No restoration for deleted expenses; permanent group deletion removes history | These are deliberate current deletion semantics, not an archive or refund mechanism |
| No live push updates | Another open browser must refresh after changes |
| Complete-ledger reads grow with history | Financial reads use a group lock and memory proportional to history; dashboard groups are not one simultaneous snapshot |
| Automated evidence has a defined scope | 670 isolated tests passed on 18 November 2026; 26 local PostgreSQL tests passed on 15 November 2026. Application schema/marker verification remains dated 28 October 2026 evidence. Full HTTP/browser journeys, production cookies and broad accessibility checks remain unverified. Hosted application checks are not applicable to the current local-only website; hosted CI is separately recorded |

## Future Proposals — Unprioritised

These are retained proposals, not scheduled commitments. Product and security decisions are needed before implementation where noted.

| Proposal | User benefit | What completion would mean |
| --- | --- | --- |
| Group-creation retry safety | Avoid duplicate groups after an uncertain submission | Persist an intent key with payload matching and prove retries return one group/member/event set; group names must not be used as keys |
| Guest session recovery and multiple-group access | Return to a claimed identity and use several groups without losing access | An explicitly designed identity-verification/recovery flow, safe per-group session selection and tests that prevent impersonation |
| Optional account linking | Keep all participating groups accessible through an account | Link the verified existing GroupMember to the account without duplicating membership or moving financial records; retain Skip/guest participation |
| Member management | Let owners maintain the group roster | Owner-authorized add/deactivate controls, duplicate-name policy, activity and same-group checks, while preserving historical records |
| Invitation disable/regeneration controls | Let owners stop new claims or replace a shared URL | Owner-only controls enforce existing access policy, invalidate old tokens on regeneration and explain effects on existing guests |
| Percentage splitting | Divide expenses by agreed proportions | Define percentage validation and penny allocation; shares always sum exactly to the total through review and persistence |
| Settlement suggestions | Help members see who could pay whom | Define a deterministic suggestion policy compatible with existing expense allocations; suggestions must not move money or mark it paid |
| Broader payment lifecycle controls | Resolve mistakes beyond current rejection/reconciliation | Agree cancellation/reversal permissions and audit/balance effects first, then verify each approved transition |
| Historical-payment recovery | Resolve records that cannot satisfy current association rules | Investigate actual histories and approve an explicit recovery procedure without inventing expenses or changing transfers silently |
| Notifications | Help people notice relevant changes | Agree events, channels and preferences before implementation; protect private group information |

### Additional ideas

Earlier planning also proposed expense categories, receipt/image attachments, comments or notes, payment-method labels, and multiple currencies/exchange rates. Preserve these as ideas for later discussion. Their scope, acceptance criteria and priority have not been agreed. A `/groups` index is not currently present; it is not an agreed requirement merely because older notes mentioned it.

## Maintaining this roadmap

1. Mark a task `[x]` only after verified implementation or completion of its stated verification; keep unfinished work `[ ]`.
2. Split partially completed work into completed and outstanding items.
3. Update the overview and phase status together when actual progress changes.
4. Keep unprioritised proposals separate from approved milestones. Add Phase 10, Phase 11 and later milestones using the same goal, checklist and outcome format when agreed.
5. Record only evidenced dates and results; never present historical checks as newly executed.
6. Remove limitations only when resolved. Keep detailed behaviour in [architecture](architecture.md), database procedures in [database design](database-design.md), and verification scenarios/results in [tests](tests.md).
7. Explain the user benefit and acceptance criteria of newly agreed work without creating duplicate progress reports or inventing delivery dates.
