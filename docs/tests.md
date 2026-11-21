# SPLITMate verification

This document owns verification commands, coverage, reported evidence and remaining checks. Feature status belongs in the [roadmap](dev-roadmap.md); expected behaviour is in [architecture](architecture.md). A passing automated check, a user-reported browser result and a live database schema check establish different things.

## Automated checkpoints

**21 November 2026 - Phase 8.3 password management:** All 731 isolated tests passed with zero failures, cancellations or skips. Next.js route-type generation, TypeScript (`npx.cmd --no-install tsc --noEmit --incremental false`), lint and production build passed. `git diff --check` passed. Build/type-generation used process-local unusable loopback database URLs; application environment files and records were unchanged.

All **31 real PostgreSQL integration tests** passed on the owned disposable PostgreSQL cluster (approximately 120 seconds): 26 existing cases plus five account-security cases. Identity and opt-in marker guards passed; migration status was up to date, schema verification passed and the full database marker matched the contract. No migration was applied. Separate workers and `pg_blocking_pids` established actual account-row contention for login-first, change-first and competing password changes. Tests also proved password/session rollback on injected revocation failure and preservation of an actual unrelated owner session and guest sessions. Cleanup found zero registered fixtures remaining.

The first integration run exposed that this Prisma RC's single-row `delete()` left another owner session intact. The service now uses `deleteAll()` for account-wide revocation, and the isolated mock prevents treating a multi-row delete as a single-row operation. The final full PostgreSQL run above passed after correction. Startup required an approved outside-sandbox retry because Windows could not create a restricted token; shutdown also required an outside-sandbox retry and the cluster was successfully stopped.

Isolated coverage includes new-password byte/character limits, exact confirmation, unchanged whitespace, wrong current password, unauthorized/expired/revoked/deleted/guest-only identity, same-origin and JSON/body guards, safe failures, session/cookie preservation on rollback, stale verified-login hashes, Security access, navigation, form labels, duplicate-submit blocking, successful field reset and uncertain-response guidance. The login success message is presentation only. The fresh-document navigation after password changes intentionally discards cached owner UI.

Browser checks and hosted CI were not executed. Manually verify Security access and responsive light/dark layouts; wrong-current/short/oversized/mismatched passwords without session loss; a successful change in two signed-in owner browsers followed by denied old-session access; old-password rejection and new-password login; unaffected guest/unrelated-owner access; rapid submissions; expired-session feedback; a lost response followed by fresh login; keyboard focus, labels and screen-reader announcements. Phase 8 remains incomplete pending browser checks and remaining settings work.

**21 November 2026 - global account navigation:** All 709 isolated tests passed with zero failures, cancellations or skips. Next.js route-type generation, TypeScript (`npx.cmd --no-install tsc --noEmit --incremental false`) and production build passed. Lint initially reported one unused landing-navigation style constant; removing that unused constant and rerunning lint produced no warnings or errors. `git diff --check` passed. Build/type-generation used process-local unusable loopback database URLs; environment files and application records were unchanged.

Global-header tests execute real owner/guest session readers against isolated database/cookie doubles. They cover all three visitor states, owner precedence without guest reads, revoked owner with valid guest, expired/revoked/inactive/unclaimed/linked/malformed guest identities, missing groups, production cookie policy, read-only classification, minimal client props and accessible home branding. Menu tests cover public link ordering without owner actions alongside existing owner sign-out wiring, dismissal, focus restoration and theme labels. Root-layout coverage checks that the shared header applies to public and protected routes; page tests retain independent profile/appearance protections. No browser DOM or live-database verification is implied.

Remaining manual checks: landing/login/register and protected-page account icon; owner, guest-only and signed-out choices; home branding from each route; 320px/360px/390px and desktop layouts; mouse/touch opening, outside dismissal, Escape focus restoration, Tab/Shift+Tab; theme persistence and no hydration/console errors; sign out and subsequent access. Browser checks, hosted CI and disposable PostgreSQL integration tests were not run for this UI change. No schema, financial behaviour or session policy changed.

**21 November 2026 - account navigation refinement:** All 694 isolated tests passed with zero failures, cancellations or skips. Next.js route-type generation, TypeScript (`npx.cmd --no-install tsc --noEmit --incremental false`), lint, production build and `git diff --check` passed. The build used process-local unusable loopback database URLs without changing environment files or connecting to the application database.

New account-menu tests exercise disclosure markup, ordinary navigation destinations, the existing sign-out action reference, navigation dismissal, outside-pointer/focus dismissal, Escape focus restoration, listener cleanup and theme icon accessible labels. Profile tests cover protected Appearance access and the removal of content sign out; redirect tests include Appearance. Existing theme persistence, pre-hydration activation and fallback tests remain passing. These are isolated handler/element-tree tests, not proof of native browser disclosure, focus traversal or hydration behaviour.

Remaining browser checks: desktop and 320px/360px/390px layouts; both themes and persistence; dropdown opening by mouse/touch/keyboard, outside dismissal, Escape and Tab/Shift+Tab; sign out and subsequent access denial; guest-only/signed-out navigation; long account details; no horizontal overflow, hydration warnings or console errors. Browser interaction tests, hosted CI and PostgreSQL integration tests were not run for this UI refinement. No database or financial logic changed.

**21 November 2026 — read-only owner profile:** `node --test tests/*.test.mjs` passed all 687 isolated tests with zero failures, cancellations or skips. The focused profile/auth-page run passed 55 tests. Next.js route-type generation, `npx.cmd --no-install tsc --noEmit --incremental false`, and `npm.cmd run lint` passed. `npm.cmd run build` passed after a network-enabled retry for the existing Google Fonts; the sandboxed build could not download them. Build/type-generation commands used process-local unusable loopback database URLs; no environment files or application database records were changed.

Profile tests execute the real account reader and owner-session validation against the existing isolated database/cookie doubles. They cover owner isolation, anonymous/expired/revoked/guest-only access, deleted accounts including disappearance between reads, minimal returned details, credential non-exposure and database failure propagation. Auth-page tests cover `/profile` returns through login and registration, malicious destinations and dashboard navigation. These tests inspect element trees and submit handlers, not a browser DOM. `git diff --check` passed.

Manual profile checks remain: desktop and 360px/390px layouts, long names/emails, both themes, keyboard focus and screen-reader headings/details; dashboard entry and return link; login-to-profile and registration return context; guest-only/signed-out denial; sign out and subsequent protected access. PostgreSQL integration tests, browser checks and hosted CI were not run for this read-only feature. Phases 8.3 and 8.4 remain outstanding.

**18 November 2026 — README and application metadata:** 670 isolated tests passed with zero failures, cancellations or skips using `node --test tests/*.test.mjs`. Lint, Next.js route-type generation and TypeScript (`npx.cmd --no-install tsc --noEmit --incremental false`) passed. `npm.cmd run build` passed after a network-enabled retry for the existing Google Fonts; the sandboxed attempt failed to download those fonts. The build used process-local, unusable loopback database URLs, with no changes to environment files or application database operations.

`git diff --check` passed. Focused assertions verified the exact single CI badge and workflow destination, balanced Markdown code fences, 32 relative documentation links and anchors, the SPLITMate title/description, and an otherwise unchanged root layout including fonts and theme bootstrap. Hosted CI conclusion evidence is recorded under [hosted verification](#hosted-verification-and-limits). Browser checks and the disposable PostgreSQL integration suite were not rerun for this documentation/metadata change. Manually check the home-page tab and description, existing route-specific titles, light/dark switching and preference persistence without a theme flash. No authentic application screenshots were present to include.

**15 November 2026 — CI preparation:** 670 isolated tests passed with zero failures, cancellations or skips. Lint, Next.js route-type generation and TypeScript (`npx.cmd --no-install tsc --noEmit --incremental false`) passed. The production build passed with process-local, unusable loopback database URLs after a network-enabled retry for Google Fonts; application database credentials were not used. GitHub-hosted execution remains unverified until the workflow is pushed. The CI changes are confined to the workflow, README and this document; existing application, test and dependency files are unchanged by this task.

The 26 real PostgreSQL tests also passed with zero failures, cancellations or skips on the existing owned local PostgreSQL 18 cluster (approximately 119 seconds). Startup and shutdown required retries outside the Windows sandbox. The migration preview reported already up to date; schema and full contract-marker verification passed before testing. No migration was applied during this local run. Cleanup found zero registered fixtures remaining and the cluster was stopped. This establishes current test compatibility, not a fresh Ubuntu installation or migration rehearsal. Workflow YAML parsing, structural assertions, package/lockfile root consistency and `git -c core.safecrlf=false diff --check` passed; actionlint, a fresh `npm ci` installation and GitHub-hosted execution were not run.

**13 November 2026 — compact payment history and activity:** 670 isolated tests passed with zero failures, cancellations or skips. Lint and TypeScript validation (`npx.cmd --no-install tsc --noEmit --incremental false`) passed. The seven new cases in `tests/group-history.test.mjs` cover concise summaries, GBP conversion, London winter/summer and DST boundaries, original details/timestamps, native disclosure structure, empty states and owner-only controls. The payment UI test now expects independent closed history disclosures while continuing to exclude guest review controls. These element-tree tests do not execute browser toggling or establish visual layout quality. Existing theme contrast tests passed.

Manual history checks remain: at 360px, 390px and desktop widths in both themes, verify long member names and large amounts wrap without horizontal scrolling; independently open/close several rows by clicking the row/chevron and by Tab then Enter/Space; verify visible focus, announced expanded state and reduced-motion preference; inspect full original activity and payment details; check empty states, owner reconciliation/rejection visibility, member-card confirmation and guest absence of management controls. Browser checks and PostgreSQL integration tests were not rerun, and no database operations or migrations were performed.

`npm.cmd run build` passed after a network-enabled retry (the sandboxed attempt could not fetch the existing Google Fonts). `git -c core.safecrlf=false diff --check` passed. No dependencies, API contracts, database code or financial rules were changed by this presentation task. The previously approved documentation/comment changes remain uncommitted alongside it.

**7 November 2026 — documentation and readability review:** 663 isolated tests passed, with zero failures, cancellations or skips, matching the 28 October count. The changes document existing behaviour and rename two misleading test descriptions; assertions, fixtures and executable application logic are unchanged.

| Executed command | Result |
| --- | --- |
| `node --test --test-reporter=dot tests/*.test.mjs` | Passed |
| `node --test --test-reporter=spec tests/*.test.mjs` | 663 passed; repeated after final comment refinements to capture the explicit summary |
| `npm.cmd run lint` | Passed |
| `npx.cmd --no-install tsc --noEmit --incremental false` | Passed |
| `npm.cmd run build` | Passed after a network-enabled retry; the sandboxed attempt could not fetch the existing Google Fonts |
| `git -c core.safecrlf=false diff --check` | Passed; the command-local setting suppresses line-ending conversion warnings without changing repository configuration |

Read-only Node/TypeScript checks compared all 41 modified script files against HEAD, normalizing line endings and removing comments; syntax trees matched after allowing exactly the two test-title replacements. CSS declarations were unchanged. All 340 literal local imports and 48 relative Markdown file links resolved. Tracked JSON and generated contract declarations parsed successfully. Migrations, contracts, dependency manifests and database configuration were unchanged. These checks do not verify external links or application behaviour in a browser.

The disposable PostgreSQL configuration existed, but its owned cluster had no running-server PID file. The integration suite was **not rerun**, and the cluster was not started or migrated. The 26-test PostgreSQL result below remains dated historical evidence. No application database operations, browser checks, contract emission or migration commands were performed for this review.

### Earlier integration checkpoint

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

## GitHub Actions CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs all checks on pushes to `main`, pull requests targeting `main` (opened, reopened or updated), and `workflow_dispatch`. There are no path filters. A newer run cancels an obsolete run for the same event/ref; failures in one quality matrix job do not cancel its siblings.

Each job uses GitHub-hosted Ubuntu 24.04, Node 24 and `npm ci`. Official `actions/checkout` and `actions/setup-node` are pinned to release commit hashes (v7.0.1 and v7.1.0 respectively); update hashes deliberately when reviewing newer releases. Only npm's download cache is reused, keyed by `package-lock.json`; neither `node_modules`, build output nor test database files are cached or uploaded. Repository permissions are `contents: read`, checkout does not persist credentials, and the workflow does not reference GitHub secrets or use `pull_request_target`.

| Check shown on GitHub | Command | Scope |
| --- | --- | --- |
| Automated tests | `node --test --test-reporter=spec tests/*.test.mjs` | Existing isolated regression suite |
| Lint | `npm run lint` | Existing ESLint configuration |
| TypeScript | `npx --no-install tsc --noEmit --incremental false` | Runs `npx --no-install next typegen` first because a clean checkout lacks generated Next.js route types |
| Production build | `npm run build` | Production compilation and static generation |
| PostgreSQL 18 integration tests | `npm run test:integration` | 31 real-database concurrency, persistence and rollback cases |

Quality jobs have a 20-minute total limit and their checks have 10-minute limits. The integration job has a 25-minute total limit, bounded setup/migration/cleanup steps and a 12-minute test step; the harness additionally enforces its own 10-minute suite limit. No failure is suppressed with `continue-on-error`. A failed command marks its step and check as failed; open the PR's Checks tab or **Actions → CI → run → failed job** for logs. Cancelled runs are not passing evidence. Branch protection/rulesets are separate repository settings: configure the five check names as required if merges must be blocked on failure.

### Build environment and network

The workflow supplies deliberately unusable `DATABASE_URL` and `DIRECT_URL` placeholders at `127.0.0.1:1`, solely for Prisma runtime imports during compilation. They are not application credentials and no database runs at that endpoint. CI does not load private environment files, run application database migrations, emit contracts or change dependency versions. If future prerendering needs database queries, investigate that requirement rather than adding application credentials to CI.

The existing `next/font/google` imports download Geist and Geist Mono. GitHub runners need HTTPS access to `fonts.googleapis.com` and `fonts.gstatic.com`, in addition to npm/GitHub and the PostgreSQL package repository. Font download failures fail the build visibly; fonts are not mocked, TLS verification is not disabled and no application font changes are made. Local sandboxed builds may need an approved network-enabled retry.

### Disposable PostgreSQL job

The job installs PostgreSQL 18 from the [official PostgreSQL Ubuntu repository](https://www.postgresql.org/download/linux/ubuntu/) and verifies the server major version. It uses native binaries through `PG_BIN` and the existing `test:db:start` ownership protocol, rather than adopting the runner's default database service. The disposable VM's default Unix socket directory is made private to the runner so Debian's binaries can start as that unprivileged user; the harness never runs with sudo. It refuses a pre-existing `.integration-postgres` directory, then creates a fresh cluster on `127.0.0.1:55439` with a random password, test-only user/database, ownership manifest and database opt-in marker. `TEST_DATABASE_URL` comes only from the harness's generated ignored file, never a repository secret.

The sequence is `test:db:start` → `test:db:preview` → `test:db:migrate` → `test:integration`. The migrate script previews and applies existing history to this new disposable database, then verifies status, schema and marker; the test script verifies them again before running. It uses `prisma.integration.config.ts`, the locked Prisma CLI and the harness's explicit target migration. Historical destructive operations therefore affect only the empty test schema. Changing the application contract requires separately reviewing the test harness's target and migration history; this CI setup does not alter either.

Endpoint, credential-separation, live database identity and marker checks remain enabled. After a successful cluster start, `always()` cleanup steps run `test:db:cleanup` and `test:db:stop` even when migrations/tests fail. Cleanup errors remain visible. GitHub disposes of the runner after the job, including after interruption; no cluster is reused between runs. Logs and credential files from the test cluster are not uploaded.

### Hosted verification and limits

On 18 November 2026, a read-only GitHub API query independently confirmed that [run 43767547165](https://github.com/hamdqasim25/Split-Mate/actions/runs/43767547165) for `ci.yml` on `main`, commit `0e6244906caf87b00e78a2d129e8c5ae2ba04a62`, completed successfully on 15 November 2026 at 22:10 UTC. This confirms the hosted workflow's reported conclusion; individual job logs and test counts were not independently audited in this check. The earlier CI-preparation checkpoint records what was known before that hosted verification.

For future runs, inspect all five checks. Verify that the integration log reports PostgreSQL 18, successful test-only migrations/verification, 31 passing tests and successful cleanup/stop. Check that the other jobs pass independently and that no credentials appear in logs. **Actions → CI → Run workflow** provides manual execution; pushes to `main` also run it automatically.

The README now displays the live `ci.yml` badge for `main`, linked to the workflow's Actions page. Local results do not establish hosted success, and a passing badge does not verify uncommitted changes.

CI does not deploy, verify the Prisma-hosted application's schema/data, prove migrations safe for existing application data, execute full HTTP/browser journeys, or establish mobile layout, accessibility or production HTTPS-cookie behaviour. Those checks remain separate below.

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

### Navigating the test infrastructure

Top-level `*.test.mjs` files are grouped by behaviour rather than mirroring every route directory. Most feature suites use `helpers/guest-environment.mjs`, which adapts Next.js imports, simulates transactions with staged records and retains React hook state for explicit rerenders. `helpers/auth-environment.mjs` isolates owner account/session tests; `helpers/group-database.mjs` supplies the smaller group-creation transaction double. These helpers intentionally model only the operations their tests need.

For the real database suite, start at `integration/config.mjs` (target guards), then `fixtures.mjs` (registered disposable records and cleanup), `harness.mjs` (observer and competing workers), and `worker.mjs`/`runtime.mjs` (real services and Prisma connections). `concurrency.test.mjs` observes actual database blocking; `rollback.test.mjs` injects database failures after intermediate writes. `cli.mjs` runs guarded commands, while `postgres.mjs` manages the separate local cluster. Script names and setup requirements are listed above.

Test names describe the asserted behaviour. Fixture IDs are local to the test; they are not application identities. A simulated race or discarded service response must not be described as a real PostgreSQL race or interrupted browser connection.

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

In the Phase 8.3 request, the user reported Phase 8.2 completed, manually verified and committed on `feat/profile-settings`. Individual browser scenarios were not supplied; this is user-reported evidence, not a new browser audit.

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
