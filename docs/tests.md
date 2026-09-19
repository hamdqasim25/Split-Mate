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
npx eslint src/app/actions/guest.ts "src/app/g/**/*.tsx" src/components/groups/claim-member-form.tsx src/components/groups/guest-sign-out.tsx src/components/groups/share-link.tsx src/data/invites.ts src/data/guest-groups.ts src/lib/auth/tokens.ts src/lib/auth/session.ts src/lib/auth/guest-session.ts "tests/**/*.mjs"
```

On Windows, use `npx.cmd` and `npm.cmd` if PowerShell blocks the `.ps1` wrappers. Builds use the existing private environment configuration; never print or commit it. Review `git diff`, `git diff --check` and `git status` after verification. Stage only intended files.

## Automated coverage by area

| Area | Coverage and evidence |
| --- | --- |
| Owner auth | Registration validation, bcrypt hashing, generic login errors, token hashing/cookies, expiry, revocation, request-origin/body checks and safe errors; `auth.test.mjs` |
| Owner pages/forms | Authentication guards, safe login destinations, form validation, pending/error states and landing/dashboard rendering; `auth-pages.test.mjs` |
| Group creation/dashboard | Transactional owner/guest creation and activity, secure share token, invalid input/duplicate names, rollback simulation, owner-scoped dashboard reads and projections; `create-group.test.mjs`, `dashboard.test.mjs` |
| Owner group access | Shared owner-auth/dashboard guards are tested. Dedicated `/groups/[groupId]` and `getGroupForOwner` authorization tests are not yet present; do not infer full owner-detail coverage from dashboard tests. |
| Invite resolution | Valid, malformed, unknown and disabled invites; minimal output and eligible active/unclaimed guest filtering; `invites.test.mjs` |
| Member claiming | Same-group eligibility, rejection of claimed/inactive/owner/account-linked members, hashed session and MEMBER_CLAIMED, rollback and simulated competing claims; `invites.test.mjs` |
| Guest sessions | Cookie security, expiry, malformed/unknown credentials, missing records, group/member mismatch and separation from owner credentials; `guest-session.test.mjs` |
| Protected guest group access | Safe projections, active member filtering, latest 10 allowed events in deterministic order, matching-session requirement, disabled-invite policy and throttled timestamps/rollback; `guest-groups.test.mjs` |
| Guest page/navigation | Group/current identity, joined/waiting states, activity/expense placeholder, redirects, generic errors, session reuse and compatibility route; `guest-group-pages.test.mjs`, `invite-pages.test.mjs` |
| Guest sign-out | Revocation, cookie clearing, owner/unrelated session preservation, retained claimedAt, revoked-token replay rejection, failure handling and UI feedback; `guest-session.test.mjs`, `guest-group-pages.test.mjs` |

## Manual testing completed

- Earlier recorded owner creation testing against Prisma-hosted PostgreSQL verified the Group, claimed OWNER member, guest members with null userId/claimedAt and GROUP_CREATED event.
- An earlier read-only dashboard query verified a persisted group, active-member count and activity without returning the share token.
- The developer reported that separate browser profiles can claim separate guest names, claimed members disappear from the available list and multiple guests join independently.

These are historical/reported checks, not new live tests performed during documentation verification. No completed manual protected-group/sign-out test is claimed.

## Remaining verification and limitations

- Test doubles cannot prove live PostgreSQL locking, race outcomes or rollback behaviour. Use a designated test database for concurrent claims and failure injection.
- No browser automation, full HTTP end-to-end suite, visual/mobile accessibility audit or production HTTPS-cookie test is present.
- Dedicated owner group-detail authorization tests remain missing.
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

## Current verification checkpoint

Guest milestone checkpoint, 19 September 2026:

| Check | Result |
| --- | --- |
| `node --test tests/*.test.mjs` | 190 passing |
| `npx tsc --noEmit` | Passing |
| Targeted ESLint command above | Passing |
| `npm run build` | Passing |

The checkpoint must reflect an actual run, not code inspection. See the final milestone commit for the corresponding implementation.

## Short milestone test history

| Milestone | Automated checkpoint |
| --- | --- |
| Owner auth, group creation and persisted dashboard | 120 tests across four suites |
| Guest invite/member claiming and session confirmation | 153 tests; added 33 guest tests |
| Protected guest group access, activity tracking and sign-out | 190 tests; added 37 tests |

Current suite totals: owner auth 32; owner pages/forms 38; creation 32; dashboard 18; invites 16; guest sessions 18; invite pages 8; guest group service 18; guest group pages 10.

## Project convention

Future milestones must update relevant documentation, README Current Progress and this file when behaviour or testing changes. Record commands actually run, results, manual evidence and remaining gaps; keep coverage at feature level rather than listing every test. Preserve historical checkpoints and distinguish implemented functionality from planned work.
