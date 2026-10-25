# SPLITMate verification

This document owns verification commands, coverage, reported evidence and remaining checks. Feature status belongs in the [roadmap](dev-roadmap.md); expected behaviour is in [architecture](architecture.md). A passing automated check, a user-reported browser result and a live database schema check establish different things.

## Latest recorded automated checkpoint

**25 October 2026: 609 passing tests**, plus lint, TypeScript and production build reported passing. This is the previously reported checkpoint, not a rerun during documentation consolidation.

| Recorded command | Reported result and scope |
| --- | --- |
| `node --test --test-reporter=dot tests/*.test.mjs` | 609 passing tests using isolated database/runtime/React doubles |
| `npm.cmd run lint` | Full maintained project passed, with generated/build/dependency and identified local tooling exclusions |
| `npx.cmd --no-install tsc --noEmit --incremental false` | TypeScript check passed |
| `npm.cmd run build` | Production build passed; this does not execute live protected journeys |

The latest change added 24 payment-form regression cases. A £5 payment could commit successfully, then the hidden allocation component tried to parse the cleared total `""` during form reset and threw a RangeError. The reproduction covered `5`, `5.0` and `5.00`, each representing 500 pence. Clearing or entering an intermediate draft such as `5.` could also fail during rendering.

The fix handles expected draft parsing failures at the rendering boundary, retains raw input, provides inline errors and avoids misleading partial totals. Blank unused allocation fields are omitted; invalid submitted totals/nonempty allocations still fail the unchanged strict server parser rather than becoming zero. Tests render the child after parent reset and simulate retry after a post-commit refresh failure, verifying one payment, allocation and activity event. Request-key handling remains unchanged.

## Commands

From the repository root, with locked dependencies installed and Node 24:

```powershell
node --test tests/*.test.mjs
npx.cmd --no-install tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
```

For a focused run, use a specific file, for example `node --test tests/guest-groups.test.mjs`. There is no `npm test` script. On platforms without Windows wrappers use `npm` and `npx` instead of `.cmd`.

Builds use the existing private environment configuration; never print or commit it. Existing Google Font downloads may require network access. Inspect `git diff`, `git diff --check` and `git status` after checks and review intended changes. Database procedures and their approval requirements are in [database design](database-design.md#contract-and-migration-workflow); an ordinary test/build run is not approval to migrate or modify live data.

## What automated tests establish

Tests use Node's built-in `node:test` and `node:assert/strict`. Node 24 module hooks replace database, cookies, navigation and server-only imports. TypeScript services execute with Node support; TSX tests use the installed TypeScript transpiler and lightweight React-hook doubles. A double is a controlled replacement for a real system, used to simulate errors and inspect behaviour.

These tests exercise real validation, cryptographic helpers and business logic against in-memory records. Transactions simulate rollback and serialized competing operations. Component tests inspect rendered element trees and action behaviour, not a browser DOM. They do not use cloud credentials or prove PostgreSQL locks, foreign keys or unique constraints under real concurrency. TypeScript, lint and build checks add compilation/static checks, not end-to-end proof.

| Area | Covered behaviour | Test files in `tests/` |
| --- | --- | --- |
| Owner authentication | Validation, bcrypt, generic errors, token hashing/cookies, expiry/revocation, origin/body guards, safe redirects and form feedback | `auth.test.mjs`, `auth-pages.test.mjs` |
| Group creation and dashboard | Atomic member/activity creation, duplicate-name rules, secure token, rollback simulation, owner-scoped reads, exact separate totals and unavailable states | `create-group.test.mjs`, `dashboard.test.mjs` |
| Invites and guest sessions | Eligible claims, simulated competing claims, same-group access, disabled-link policy, expiry, throttled activity, revocation and retained claims | `invites.test.mjs`, `invite-pages.test.mjs`, `guest-session.test.mjs`, `guest-groups.test.mjs`, `guest-group-pages.test.mjs` |
| Expense identity and persistence | Owner/guest and mixed-cookie boundaries, inactive/foreign members, actor versus payer, input validation, shares, activity and simulated write failures | `expenses.test.mjs`, `expense-actions.test.mjs` |
| Expense amounts and screens | Exact pence, deterministic remainders, zero shares, limits, review/back/edit, custom totals/reset, form feedback and latest-50 lists | `expense-money.test.mjs`, `expense-pages.test.mjs`, `expense-review.test.mjs`, `expense-groups.test.mjs` |
| Balances | Full histories beyond display limits, exact large aggregates, inactive members, invalid-ledger rejection and consistent simulated reads | `balances.test.mjs`, `dashboard.test.mjs`, `expense-groups.test.mjs` |
| Repayments | Owner review/direct entry, guest sender isolation, pending reservations, exact amounts, stale/foreign requests, retry matching, audit and simulated races | `payments.test.mjs`, `payment-ui.test.mjs` |
| Payment associations | Full/partial deletion effects, unrelated allocations, historical reconciliation, frozen exclusions, version checks, edit compatibility, retry replay and serialized races | `payment-allocations.test.mjs` |
| Saved expense management | Owner-only access, exact custom values, historical inactive roles, stale/duplicate edits, deletion, rollback and refreshed dashboard including older expenses | `expense-management.test.mjs` |
| Permanent group deletion | Full cleanup order, rollback at every stage, session recheck after lock wait, other-group/account preservation, revoked access and dialog/action behaviour | `group-deletion.test.mjs` |
| Payment diagnostics | Allowlisted error codes without secrets, safe handling of wrapped errors/getters, and distinction between mutation and post-commit refresh failures | `payment-diagnostics.test.mjs` |
| Theme and responsive controls | Preference bootstrap/storage, legacy media-query compatibility, native activation, disclosure state, markup and semantic token contrast | `theme.test.mjs`, `payment-ui.test.mjs` |

Owner-detail authorization has targeted service/page coverage, not comprehensive HTTP/browser coverage. Simulated rollback, serialization and duplicate-key checks must not be labelled live database guarantees.

## User-reported browser evidence

These are user reports, not browser automation performed during consolidation. Dates were not supplied for every report.

- Separate browser profiles could claim separate guest names; claimed names disappeared from the available list and multiple guests joined independently.
- Existing equal/custom expense flows, displayed amounts owed, owner/guest payment flows and dashboard balances were reported manually verified.
- For the payment reset-crash incident, the user confirmed that the original payment had saved and updated balances, then confirmed that the fixed payment form worked. This confirms that specific experience; it does not establish all payment, deletion, reconciliation, mobile or browser flows.

The theme compatibility defect was reproduced in isolated code, but its relationship to the user's particular phone was not independently established. No comprehensive protected-group/sign-out browser verification is recorded.

## Previously reported live-database evidence

| Evidence | What was established | What was not established |
| --- | --- | --- |
| Earlier owner group creation against Prisma-hosted PostgreSQL | Group, claimed OWNER, guest members with null account/claim fields and GROUP_CREATED were recorded | General concurrency and failure rollback |
| Earlier read-only dashboard query | Persisted group, active-member count and activity without returning shareToken | Every dashboard/browser path |
| Payment-reporting deployment on 18 October 2026 | Ten operations applied; migration status, schema and full contract-marker verification reported successful | Real simultaneous financial transactions |
| Supplied allocation deployment report | `20261022T2235_expense_payment_allocations` applied successfully and schema-verified on the configured database | Other environments, automatic historical reconciliation, or live contention/rollback |

The allocation report supersedes the older "unapplied" milestone notes. Its deployment date was not supplied in the correction; do not infer it from the migration name or test-checkpoint date. Exact migration references and procedures are maintained in [database design](database-design.md#reported-migration-state). Offline migration validation was also previously reported passing; it is separate from live schema verification.

## Outstanding manual and integration checks

Use disposable identities/groups in a designated test environment whose schema is verified. Never test destructive deletion, corrupt records or injected failures on live groups. Record the environment, date, actions, expected/observed result and any limitation without secrets.

### Access and sessions

1. Claim a name, verify the correct identity/members/activity, refresh and reopen the invite without creating another session. Try simultaneous claims for the same name on real PostgreSQL.
2. Attempt protected pages/actions without credentials, with expired/revoked sessions and with another group's identity; each must fail safely. Include owner-detail HTTP authorization and mixed owner/guest cookies.
3. Disable invitations using an approved test fixture: existing valid guests retain access, new guests cannot claim; inactive membership must block access.
4. Check the five-minute activity throttle, guards against overwriting newer timestamps and unchanged expiry.
5. Sign out: guest sessions are revoked, guest cookies clear, owner login remains and claimedAt is unchanged. Verify revoked-token replay fails. Test production HTTPS cookie attributes separately.

### Expenses, balances and saved edits

1. Review £10 across three participants as owner and guest. Expect £3.34/£3.33/£3.33 by internal ID, while display order follows members. No expense should exist before confirmation. Include a payer outside the participants and a submitter different from the payer.
2. Back/edit, enter custom £5/£3/£2 shares, reset to equal and save. Verify exact persisted shares, actor/event, redirects and both group views. Try zero shares, 1p totals, invalid precision, empty descriptions and duplicate/foreign/inactive participants.
3. Expire a session or deactivate a member after review in controlled fixtures. Saving must fail without partial records. Inject failures during writes and test membership changes against saves on real PostgreSQL.
4. Compare full-ledger totals beyond 50 expenses, inactive historical members, zero-sum group balances and separate owner dashboard totals. Empty valid groups show zero; unavailable ledgers must not produce partial dashboard totals.
5. Edit a saved custom split: preserve values through review/back/cancel, change total/participants and resolve the remainder. Check historical inactive roles and payment-linked edit restrictions. Verify owner/guest/dashboard refresh and denied guest management access.
6. Open two tabs: save in one and verify the other cannot overwrite/delete it. Include a change later restored to the original values. Check real edit/delete races and rollback.

### Repayments, associations and reconciliation

1. Report £7.01 against a £20.01 debt with explicit allocations. Pending must leave balances unchanged; owner confirmation must apply effective amounts to both views and the dashboard. Reject another report and verify reservations release without financial effect.
2. Record a verified external payment directly, including unclaimed members and a non-owner recipient. Verify third-party confirmation wording, actual actor and equivalent-pending-report protection.
3. Try self-payment, excess/reserved amounts, stale eligibility, invalid/cross-group IDs, expired sessions and inactive members. Owners can reject stale inactive-member reports but cannot confirm them.
4. Delete a fully settled single expense: both members should be even for that expense, with payment history retained and its allocation excluded. For a payment spanning two expenses, deleting one must leave the other's effect intact.
5. Delete an expense with a pending allocation. Fully excluded reports cannot be confirmed; partially excluded reports need fresh review. An old form or retry must not revive an allocation or duplicate payment/activity.
6. Reconcile a historical payment from real evidence; verify blocked financial edits/deletion before reconciliation and valid behaviour afterward. Test stale reconciliation tabs and frozen excluded allocations. Do not invent associations for unsupported netted/hard-deleted history.
7. Exercise lost responses, repeated clicks and concurrent owner decisions on real PostgreSQL. Check unique request keys, same-payload replay, lock ordering, complete rollback and coherent ledger reads. A new form/key is not proof that a bank transfer occurred twice.

### Permanent group deletion

1. Verify the named warning, Cancel/Escape, focus confinement and restoration, pending/error feedback and protection against repeated submission. Cancel must leave records intact.
2. In a disposable group containing inactive members, soft-deleted expenses and every payment state, delete and verify complete dependent cleanup, invalid invite/session credentials, preserved accounts/other groups and updated dashboard totals.
3. Check actual foreign-key order, failures at each cleanup stage and contention with expense/payment writes and guest claims. Repeated deletion requests must not affect another group.

### Browser, mobile and accessibility

Check 360px/390px and desktop layouts in both themes, long names/large amounts, keyboard focus, labels, errors and announcements, touch targets, overflow, disclosures and retained form intents. Test theme before hydration, after navigation, with legacy media-query APIs and blocked storage. Verify payment clearing/intermediate input/reset, retries and fresh data after another browser refreshes. There is no full browser automation or complete HTTP end-to-end suite, visual/mobile accessibility audit or production HTTPS-cookie verification recorded.

## Maintaining evidence

Replace the latest automated checkpoint only after actually running the commands; record date, results and scope. Keep distinct user reports and live-database evidence without presenting them as fresh checks. Update coverage/checklists when behaviour changes and move completed gaps to dated evidence. Do not append repetitive milestone histories or require unrelated README updates for every test change.
