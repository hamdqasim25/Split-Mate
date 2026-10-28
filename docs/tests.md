# SPLITMate verification

This document owns verification commands, coverage, reported evidence and remaining checks. Feature status belongs in the [roadmap](dev-roadmap.md); expected behaviour is in [architecture](architecture.md). A passing automated check, a user-reported browser result and a live database schema check establish different things.

## Automated checkpoints

**25 October 2026: 663 passing isolated regression tests and 26 passing real PostgreSQL integration tests**, with zero failures or skips. The isolated suite includes 40 expense-retry cases and 14 integration-target safety checks. PostgreSQL 18 ran in a dedicated local cluster, separate from the application database.

| Executed command | Result and scope |
| --- | --- |
| `node --test --test-reporter=spec tests/*.test.mjs` | 663 passed, zero failed/skipped; isolated database/runtime/React doubles and configuration safety checks |
| `npm.cmd run test:integration` | 26 passed, zero failed/skipped; actual PostgreSQL transactions and separate worker connections; final run approximately 121 seconds |
| `npm.cmd run test:db:preview`, `test:db:migrate`, `test:db:verify` | Reviewed/applied six migrations (110 operations) to an empty dedicated test cluster; status, schema and full contract marker verified |
| Focused expense/action/page/management/group and payment/allocation tests | Passed before the final full-suite run |
| `npm.cmd run lint` | Passed |
| `npx.cmd --no-install tsc --noEmit --incremental false` | Passed |
| `npm.cmd run build` | Passed; production compilation, TypeScript and static generation completed |
| `npx.cmd --no-install prisma contract emit` | Passed in the preceding expense-retry implementation with the locked RC toolchain; no schema/artifact changes needed for integration tests |
| `npx.cmd --no-install prisma migration plan --from 20261022T2235_expense_payment_allocations --name expense_request_keys` | Prepared one additive migration from the explicit existing contract |
| `npx.cmd --no-install prisma migration show 20261025T1709_expense_request_keys` | Reviewed two nullable columns and one unique constraint; no backfill or destructive operations |
| `npx.cmd --no-install prisma migration check` | All offline checks passed |
| `git diff --check` | Passed |

Expense retry tests cover owner and guest creation; one key across review, back/edit, rerenders, replacement server props and failures; a committed save whose response is lost followed by a retry; eight simultaneous identical requests through the serialized database double; conflicting description/total/payer/shares; canonical formatting and ordering; deliberately identical expenses with different keys; malformed/missing/duplicate/file-valued keys; wrong actor, unauthorized and cross-group replay; session revocation during a simulated lock wait; replay after real edit/delete service calls, including retained payment exclusions; and participant/activity rollback followed by a successful same-key retry. The transport recovery handler preserves framework redirects, and a post-commit refresh failure renders saved-state navigation instead of another save button. Saved-expense forms omit creation keys.

**Evidence limits:** the 25 October integration evidence is from local PostgreSQL 18, not the Prisma-hosted application database; that test milestone did not modify application data or schema. The application migration was subsequently applied on 27 October and independently verified on 28 October, as described below. Full HTTP/browser, production cookie and mobile verification remains outstanding. Lost-response tests discard a committed service result; they do not interrupt a real HTTP connection.

## Application migration verification — 28 October 2026

Recovered the interrupted 27 October command: exit code 0, one migration applied with three additive operations, successful post-apply status/schema/full marker verification, and unchanged existing expense fields, shares, payments and activity rows. No second migration was run. Independent read-only checks against the configured application DIRECT_URL then passed:

| Executed command (locked local Prisma RC) | Fresh result |
| --- | --- |
| `prisma migration status --db "$env:DIRECT_URL"` | Up to date; `20261025T1709_expense_request_keys` applied |
| `prisma db verify --schema-only --db "$env:DIRECT_URL"` | Database schema satisfies contract; no issues/warnings |
| `prisma db verify --db "$env:DIRECT_URL"` | Database marker and schema match contract; codec coverage reported skipped |

Fresh repository checks on 28 October 2026 also passed: **663 isolated tests, zero failed/skipped**, `npm.cmd run lint`, `npx.cmd --no-install tsc --noEmit --incremental false`, `npx.cmd --no-install prisma migration check`, and `npm.cmd run build`. The build initially failed because the sandbox could not download the existing Google Fonts, then passed with approved network access. `git diff --check` passed. The migration snapshot JSON is semantically identical to the emitted application contract, and its generated types match exactly. No application source fixes were needed during this verification; the 26 real PostgreSQL tests remain the previously recorded 25 October result and were not rerun.

Exact hashes, reviewed operations and deployment scope are in [database deployment evidence](database-design.md#expense-request-migration-deployment). Credentials were loaded privately; neither connection strings nor financial row contents are recorded here. This was migration verification, not a rerun of the 26 PostgreSQL integration cases or browser testing.

The user confirmed the website is local-only. Hosted verification is therefore **not applicable**, and no hosted deployment was published. The prior browser attempt stopped because Computer Use could not reliably determine Chrome's current URL; no browser flow was verified. On resumption the user explicitly reserved all browser checks for themselves, so no browser automation/checks were run. Owner/guest creation, equal/custom shares, key retention through review/back/edit/errors, genuine committed-response loss and retry, conflicting-key feedback and fresh keys remain manual checks. A successful service replay or disabling networking before saving must not be reported as browser lost-response proof.

## Real PostgreSQL integration suite

Install the locked dependencies and use Node 24 and native PostgreSQL 18 binaries on PATH. On Windows, alternatively set `PG_BIN` to the PostgreSQL `bin` directory. These commands use a separate local cluster; they never fall back to DATABASE_URL or DIRECT_URL:

```powershell
npm.cmd run test:db:start
npm.cmd run test:db:preview
# Review the preview, then explicitly apply to this disposable test database:
npm.cmd run test:db:migrate
npm.cmd run test:db:verify
npm.cmd run test:integration
npm.cmd run test:db:cleanup
npm.cmd run test:db:stop
```

The start command creates an owned cluster on port 55439, a random password and ignored `.integration-postgres/test.env`; it does not change application `.env` files. Stopping preserves the cluster for reuse. Windows may require permission to start/stop PostgreSQL outside the process sandbox. An explicit TEST_DATABASE_URL overrides that file, including an empty value, which fails safely. Accepted targets require 127.0.0.1, a non-default port, database `splitmate_integration`, user `splitmate_test`, a password and no URL options. Application endpoints and reused application credentials are rejected. Every test/migration connection must also pass a database identity and opt-in comment check. The local setup creates that marker; arbitrary databases are refused.

`prisma.integration.config.ts` uses the pinned CLI and existing migration history. A fresh empty cluster needs all six migrations; historical destructive operations are confined to that empty test schema. Migration logs are retained under the ignored local directory. This task changed no historical migrations or generated contracts and did not advance the application database ref.

Workers import the real services, authorization, validation, ledger and Prisma runtime. Only the Next.js cookie/server-only boundary is adapted; sessions and token hashes are real persisted fixtures. Each worker owns a one-connection pool, with contract verification warmed before entering transactions. An independent connection reads final records. A test-only trigger pauses the first writer after it owns the group lock; the observer proves the second backend is blocked using `pg_blocking_pids` before releasing the first. Polling, SQL, connections, workers and the suite all have time limits.

| Real-database cases | Assertions |
| --- | --- |
| Competing member claims | One successful claim/session/event |
| Owner and guest identical expense submissions | Same committed ID, one expense, one share set, one creation event |
| Lost result, equivalent formatting/order, conflicting details and distinct keys | Original result on replay; conflicts cause no changes; new keys allow identical expenses |
| Missing authorization, wrong actor and cross-group replay | Keys never grant access, including an otherwise authorized second group |
| Retry after edit and soft deletion | Original identity retained; edits remain; deletion and payment exclusions are not revived |
| Competing payment reservations | Two requests for £7 against £10 cannot reserve £14; pending reports do not affect balances |
| Expense deletion versus confirmation, both lock orders | Correct terminal/pending state, excluded allocations, events and zero effective balances |
| Group deletion versus expense/payment/claim, both lock orders | Complete dependent cleanup, no orphan shares/allocations/sessions, account preserved and access revoked |
| Nine injected write failures | Actual PostgreSQL P0001 after intermediate share/session/allocation/activity/deletion writes; complete rollback and successful subsequent retry |

Fixtures are registered by random run ID and an exact test-only owner email. Cleanup checks both before deleting only that fixture's dependencies in foreign-key order. Normal tests clean up automatically; `test:db:cleanup` recovers registered fixtures after interruption without truncating tables. One interrupted development run was recovered this way. After the final successful suite, cleanup found zero registered fixtures remaining and the local cluster was stopped. No database transaction or persistence double is used in these 26 cases; the separate 663-test suite retains simulated coverage for broader validation/UI cases.

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

The isolated regression tests use Node's built-in `node:test` and `node:assert/strict`. Node 24 module hooks replace database, cookies, navigation and server-only imports. TypeScript services execute with Node support; TSX tests use the installed TypeScript transpiler and lightweight React-hook doubles. A double is a controlled replacement for a real system, used to simulate errors and inspect behaviour. The real PostgreSQL suite described above is separate.

These tests exercise real validation, cryptographic helpers and business logic against in-memory records. Transactions simulate rollback and serialized competing operations. Component tests inspect rendered element trees and action behaviour, not a browser DOM. They do not use cloud credentials or prove PostgreSQL locks, foreign keys or unique constraints under real concurrency. TypeScript, lint and build checks add compilation/static checks, not end-to-end proof.

| Area | Covered behaviour | Test files in `tests/` |
| --- | --- | --- |
| Owner authentication | Validation, bcrypt, generic errors, token hashing/cookies, expiry/revocation, origin/body guards, safe redirects and form feedback | `auth.test.mjs`, `auth-pages.test.mjs` |
| Group creation and dashboard | Atomic member/activity creation, duplicate-name rules, secure token, rollback simulation, owner-scoped reads, exact separate totals and unavailable states | `create-group.test.mjs`, `dashboard.test.mjs` |
| Invites and guest sessions | Eligible claims, simulated competing claims, same-group access, disabled-link policy, expiry, throttled activity, revocation and retained claims | `invites.test.mjs`, `invite-pages.test.mjs`, `guest-session.test.mjs`, `guest-groups.test.mjs`, `guest-group-pages.test.mjs` |
| Expense identity and persistence | Owner/guest authorization, immutable creation snapshots, canonical retry matching, conflicts, simulated concurrent submissions, lost responses, shares/activity and rollback | `expenses.test.mjs`, `expense-actions.test.mjs` |
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

1. Claim a name, verify the correct identity/members/activity, refresh and reopen the invite without creating another session. Simultaneous claims now pass on local PostgreSQL; browser refresh/reopen remains a manual check.
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
7. Local PostgreSQL coverage now proves identical-key contention, matching/conflicting replay, edit/delete preservation and participant/activity rollback. Remaining checks: drop a successful HTTP response in a browser and retry the same form/key; revoke a session during a real lock wait. Never run destructive fixtures against application financial records.

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
3. Local PostgreSQL tests now prove foreign-key cleanup, rollback after intermediate dependent deletions and both lock orders against expense/payment writes and guest claims. Broader failure points remain simulated; check repeated deletion through the browser and preservation of unrelated groups.

### Browser, mobile and accessibility

Check 360px/390px and desktop layouts in both themes, long names/large amounts, keyboard focus, labels, errors and announcements, touch targets, overflow, disclosures and retained form intents. Test theme before hydration, after navigation, with legacy media-query APIs and blocked storage. Verify payment clearing/intermediate input/reset, retries and fresh data after another browser refreshes. There is no full browser automation or complete HTTP end-to-end suite, visual/mobile accessibility audit or production HTTPS-cookie verification recorded.

## Maintaining evidence

Replace the latest automated checkpoint only after actually running the commands; record date, results and scope. Keep distinct user reports and live-database evidence without presenting them as fresh checks. Update coverage/checklists when behaviour changes and move completed gaps to dated evidence. Do not append repetitive milestone histories or require unrelated README updates for every test change.
