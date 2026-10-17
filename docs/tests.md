# SPLITMate Testing

## Approach and tools

Tests use Node's built-in `node:test` runner and `node:assert/strict`, with Node 24 module hooks to replace database, cookie, navigation and server-only imports. TypeScript services execute with Node's TypeScript support; TSX page/component tests use the installed TypeScript transpiler and lightweight React-hook doubles.

Service tests exercise real validation, cryptographic helpers and application logic against isolated in-memory database doubles. Transaction doubles simulate rollback and serialized claims. Page tests inspect rendered React elements and action behaviour without a browser or DOM. They do not connect to cloud PostgreSQL or read real credentials.

TypeScript, ESLint and the Next.js production build provide additional static/build checks. No new test dependency is required.

## Run verification

From the repository root with dependencies installed:

```bash
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

For a focused run, pass a specific test file, for example `node --test tests/guest-groups.test.mjs`. There is no `npm test` script currently.

Lint the application and test sources involved in the milestone:

```bash
npx eslint src/data/expenses.ts src/data/groups.ts src/data/guest-groups.ts "src/lib/expenses/*.ts" "src/components/expenses/*.tsx" src/components/groups/member-list.tsx src/components/groups/activity-list.tsx src/app/actions/expenses.ts "src/app/groups/[[]groupId[]]/**/*.tsx" "src/app/g/[[]shareToken[]]/expenses/**/*.tsx" "src/app/g/[[]shareToken[]]/group/page.tsx" "tests/expense*.test.mjs" tests/helpers/guest-environment.mjs tests/guest-groups.test.mjs tests/guest-group-pages.test.mjs
```

On Windows, use `npx.cmd` and `npm.cmd` if PowerShell blocks the `.ps1` wrappers. Builds use the existing private environment configuration; never print or commit it. Review `git diff`, `git diff --check` and `git status` after verification. Stage only intended files.

## Automated coverage by area

| Area | Coverage and evidence |
| --- | --- |
| Owner auth | Registration validation, bcrypt hashing, generic login errors, token hashing/cookies, expiry, revocation, request-origin/body checks and safe errors; `auth.test.mjs` |
| Owner pages/forms | Authentication guards, safe login destinations, form validation, pending/error states and landing/dashboard rendering; `auth-pages.test.mjs` |
| Group creation/dashboard | Transactional owner/guest creation and activity, secure share token, invalid input/duplicate names, rollback simulation, owner-scoped dashboard reads and projections; `create-group.test.mjs`, `dashboard.test.mjs` |
| Owner group access | Shared auth/dashboard guards, authorized detail rendering and wrong-owner read rejection; `auth-pages.test.mjs`, `expense-groups.test.mjs`. This is not comprehensive live owner-detail authorization coverage. |
| Invite resolution | Valid, malformed, unknown and disabled invites; minimal output and eligible active/unclaimed guest filtering; `invites.test.mjs` |
| Member claiming | Same-group eligibility, rejection of claimed/inactive/owner/account-linked members, hashed session and MEMBER_CLAIMED, rollback and simulated competing claims; `invites.test.mjs` |
| Guest sessions | Cookie security, expiry, malformed/unknown credentials, missing records, group/member mismatch and separation from owner credentials; `guest-session.test.mjs` |
| Protected guest group access | Safe projections, active member filtering, latest 10 allowed events in deterministic order, matching-session requirement, disabled-invite policy and throttled timestamps/rollback; `guest-groups.test.mjs` |
| Guest page/navigation | Group/current identity, joined/waiting states, activity, expense list/empty state, redirects, generic errors, session reuse and compatibility route; `guest-group-pages.test.mjs`, `invite-pages.test.mjs`, `expense-groups.test.mjs` |
| Guest sign-out | Revocation, cookie clearing, owner/unrelated session preservation, retained claimedAt, revoked-token replay rejection, failure handling and UI feedback; `guest-session.test.mjs`, `guest-group-pages.test.mjs` |
| Expense context | Real owner/guest session resolution to GroupMember, mixed-cookie isolation, cross-group protection, inactive/missing identities, safe projections, active/unclaimed member options, disabled-invite policy and read-only behaviour; `expenses.test.mjs` |
| Expense pages/form | Protected routes, safe failures, labels, payer default, member options, review totals/shares, preserved edit values, pending/error feedback and confirmation buttons; `expense-pages.test.mjs` |
| Editable review | Custom edits, exact assigned/remaining totals, under/over-allocation, invalid/zero values, reset, pending state, preserved failures and natural order; `expense-review.test.mjs` |
| Expense money | Exact decimal-to-pence conversion, invalid precision/ranges, deterministic remainder order, zero-pence shares, sums and maximum bound; `expense-money.test.mjs` |
| Expense validation/persistence | Description, amount, payer/participants, duplicates, active/same-group checks, GBP-only writes, changed membership/session after review, owner/guest success, actor identity, every participant and EXPENSE_CREATED, custom share cardinality/identity/precision/totals, exact custom persistence, EQUAL/CUSTOM classification, natural order and rollback at each of five write points; `expenses.test.mjs` |
| Expense actions | Owner/guest review/edit/save, explicit confirmation, safe errors, repeated/file fields, validated paired share fields, rejected missing/misaligned shares, ignored forged actor/redirect, post-commit destinations and revalidation; `expense-actions.test.mjs` |
| Saved expense display | Owner/guest service and page integration, safe output, scoped records, inactive historical payer, participant count, persisted split summaries, current identity, shared panels, natural member order, newest-50 ordering and empty state; `expense-groups.test.mjs` |

## Manual testing completed

- Earlier recorded owner creation testing against Prisma-hosted PostgreSQL verified the Group, claimed OWNER member, guest members with null userId/claimedAt and GROUP_CREATED event.
- An earlier read-only dashboard query verified a persisted group, active-member count and activity without returning the share token.
- The developer reported that separate browser profiles can claim separate guest names, claimed members disappear from the available list and multiple guests join independently.

These are historical/reported checks, not new live tests performed during documentation verification. No completed manual protected-group/sign-out test is claimed.

## Remaining verification and limitations

- Test doubles cannot prove live PostgreSQL locking, race outcomes or rollback behaviour. Use a designated test database for concurrent claims and failure injection.
- No browser automation, full HTTP end-to-end suite, visual/mobile accessibility audit or production HTTPS-cookie test is present.
- Owner group-detail authorization has targeted coverage but still needs broader HTTP/browser checks.
- Expense tests inspect React elements and execute Server Actions with mocked runtime boundaries; they do not simulate browser form resets, focus or checkbox interaction. Live owner/guest review/edit/save navigation and visual/mobile checks remain outstanding.
- Expense persistence and equal/custom splitting are implemented; balances, expense editing, percentage splits, payments and settlements remain pending. Pending buttons do not provide durable idempotency: retrying after a lost successful response can create a duplicate expense.
- Protected group access, disabled invitations with existing sessions, timestamp throttling and guest sign-out still need live browser/database checks.
- Targeted ESLint success is not a repository-wide lint claim; historical full scans included generated/tooling findings outside this milestone.
- Recovery of lost/expired/signed-out guest sessions, multi-group guest-cookie management and rate limiting are not implemented. Signing out does not make a claimed name available again.

Suggested manual checklist, using disposable identities:

1. Claim a name, verify `/group` displays the correct identity/members/activity, then refresh and reopen the invite without creating another session.
2. Open the protected URL without a cookie, with an expired session and from another group's browser session; each must fail safely.
3. Disable invitations in a test fixture: existing guests retain access, new visitors cannot claim. Also verify inactive membership blocks access.
4. After five minutes, verify lastSeenAt/lastActiveAt refresh; immediate reloads should not keep writing. Expiry must remain unchanged.
5. Sign out and verify revocation, cleared guest cookies, retained owner login and unchanged claimedAt. That guest identity cannot currently be recovered on this device.
6. Check narrow-screen layout, keyboard interaction, pending states and safe failure messages.
7. In a disposable GBP group, open Add expense as owner. Enter £10.00, choose three participants and review. Check £3.34/£3.33/£3.33 with the remainder assigned internally by member ID while names stay in group order; verify no expense exists yet.
8. Use Back and edit, verify all values remain, change the amount/participants and review again. Confirm and save; check the group redirect, one expense, all participant shares and one EXPENSE_CREATED event. The actor must be the submitter even when another member paid.
9. Repeat in a separate claimed-guest browser. Verify both group views show the saved expense with payer, total, date and participant count; refresh to confirm persistence.
10. Try blank description, zero/negative amounts, extra decimal places and no participants. In test fixtures, deactivate a selected member or expire the guest session after review: confirmation must fail without partial records. Check cross-group IDs via a controlled request.
11. Edit the three shares to 5.00/3.00/2.00. Check assigned 10.00 and remaining 0.00; under/over-allocation and negative/invalid entries must disable save. Reset to equal, edit again and save; verify exact custom shares and CUSTOM in the database and expandable summaries in both group views. Check keyboard and narrow-screen layout.
12. In a designated test database, inject failure after expense creation and during participant/activity writes; verify full rollback. Test concurrent member deactivation and saving to validate the membership locks. Do not modify production data for failure injection.

## Current verification checkpoint

Custom splits/group UI checkpoint, 20 September 2026:

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 334 passing |
| `npx tsc --noEmit` | Passing |
| Targeted ESLint command above | Passing |
| `npm run build` | Passing |
| `git diff --check` | Passing |

This checkpoint records local verification, not a live database/browser test. No schema, migration or dependency changes were needed.

TypeScript and ESLint were run with the Windows `npx.cmd` wrapper, and the build with `npm.cmd run build`. The earlier foundation milestone needed network access to download the existing Geist fonts; this milestone's build uses the existing font setup.

## Short milestone test history

| Milestone | Automated checkpoint |
| --- | --- |
| Owner auth, group creation and persisted dashboard | 120 tests across four suites |
| Guest invite/member claiming and session confirmation | 153 tests; added 33 guest tests |
| Protected guest group access, activity tracking and sign-out | 190 tests; added 37 tests |
| Shared expense foundation and non-persisting form | 220 tests; added 30 tests |
| Equal split confirmation, persistence and group lists | 293 tests; added 73 tests |
| Editable custom splits and improved group UI | 334 tests; added 41 tests |

Current suite totals: owner auth 32; owner pages/forms 38; creation 32; dashboard 18; invites 16; guest sessions 18; invite pages 8; guest group service 20; guest group pages 10; expense service 73; expense pages/form 11; expense money 25; expense actions 11; expense group display 10; editable review 12.

## Project convention

Future milestones must update relevant documentation, README Current Progress and this file when behaviour or testing changes. Record commands actually run, results, manual evidence and remaining gaps; keep coverage at feature level rather than listing every test. Preserve historical checkpoints and distinguish implemented functionality from planned work.
