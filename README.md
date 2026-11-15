# SPLITMate

SPLITMate helps friends track shared expenses and repayments without requiring everyone to create an account. For example, Hamdi can pay for a football pitch, split the cost with the group and see which repayments still need confirmation.

Only the group owner needs an account. Guests open a shared link and choose a name the owner has already added. SPLITMate records money paid outside the app; it does not transfer money.

## What you can do

- Create a group, add guest names and share its invitation link.
- Record GBP expenses with equal or custom shares and see member balances.
- Report repayments, have the owner confirm or reject them, and review payment history.
- Associate repayments with expenses and reconcile older payments where evidence supports the association.
- Edit or remove expenses as owner, or permanently delete an entire group with confirmation.
- Use owner and guest screens in light or dark mode.

The [roadmap](docs/dev-roadmap.md) is the authoritative list of completed features, limitations and future work. Implementation does not mean every browser or live-database scenario has been verified; see [testing evidence](docs/tests.md).

## Architecture and source navigation

Next.js hosts the pages, HTTP endpoints and Server Actions. Those entry points call server-side services for validation, permissions and transactions, using Prisma to access PostgreSQL. React components handle presentation and editable drafts. Shared money helpers calculate in integer pennies; database Decimal values and serialized amounts use exact strings.

An account (`User`) is separate from a person's membership (`GroupMember`). Expenses and repayments reference memberships so guests can participate without accounts. Financial writes use a shared group-lock protocol and record activity in the same transaction. The [architecture guide](docs/architecture.md#developer-reference) explains the boundaries and their limitations.

```text
src/
|-- app/                     # Next.js routes, pages and root styling/layout
|   |-- actions/             # Expense, payment, guest and deletion Server Actions
|   |-- api/                 # Owner authentication and group-creation HTTP routes
|   |-- dashboard/           # Owner's groups and separate owed/owing totals
|   |-- g/[shareToken]/      # Invitation and protected guest routes
|   |-- groups/              # Owner creation, detail and management routes
|   |-- login/               # Owner sign-in page
|   `-- register/            # Owner account registration page
|-- components/              # Shared UI grouped into auth, expenses and groups
|-- data/                    # Server services, transactions and ledger reads
|-- lib/                     # Auth, expense/payment helpers, types and theme bootstrap
`-- prisma/                  # Authored contract, generated artifacts and runtime
tests/
|-- *.test.mjs               # Isolated regression tests, named by feature
|-- helpers/                 # In-memory database and framework test doubles
`-- integration/             # Guarded disposable-PostgreSQL tests and tooling
migrations/
|-- app/                     # Immutable migration history and local refs
`-- snapshots/               # Generated historical contracts
docs/                        # Architecture, database, tests and roadmap
public/                      # Static assets served directly by Next.js
```

Start with these paths when reviewing the engineering decisions:

| Follow this behaviour | Main source and related tests |
| --- | --- |
| Owner sign-in and guest identity | [Account service](src/data/auth.ts), [owner sessions](src/lib/auth/session.ts), [guest sessions](src/lib/auth/guest-session.ts), [claims](src/data/invites.ts); `tests/auth.test.mjs`, `tests/invites.test.mjs` |
| Group creation and dashboard | [Group services](src/data/groups.ts); `tests/create-group.test.mjs`, `tests/dashboard.test.mjs` |
| Expense review, splitting and retries | [Form](src/components/expenses/expense-form.tsx) → [actions](src/app/actions/expenses.ts) → [service](src/data/expenses.ts), with [money helpers](src/lib/expenses/money.ts); `tests/expenses.test.mjs`, `tests/expense-money.test.mjs` |
| Balances, payment review and associations | [Ledger](src/data/balances.ts), [payment service](src/data/payments.ts), [allocation helpers](src/lib/payments/allocations.ts); `tests/balances.test.mjs`, `tests/payments.test.mjs`, `tests/payment-allocations.test.mjs` |
| Saved edits and deletion | [Expense management](src/data/expense-management.ts), [group deletion](src/data/group-deletion.ts); corresponding `tests/expense-management.test.mjs` and `tests/group-deletion.test.mjs` |

Payment UI remains in `src/components/groups/` because it is composed into group balances and history. `src/lib/expenses/form-input.ts` is a server-action parser, despite living alongside browser-safe money helpers. Routes remain in App Router locations, including the `/joined` compatibility redirect. Generated contracts and migration snapshots are retained as tooling inputs, not handwritten application code.

## Local setup

The application uses Next.js App Router, React, TypeScript, Tailwind CSS, Prisma 8 RC and Prisma-hosted PostgreSQL. Next.js runs both the interface and server logic.

1. Use Node 24 and npm. The test harness relies on Node module hooks.
2. Install the locked dependencies from the repository root:

   ```powershell
   npm ci
   ```

3. Arrange private environment configuration for the intended database. Application code and Prisma CLI configuration read `DATABASE_URL`; administrative commands explicitly use `DIRECT_URL`. Use the existing pooled application and direct administrative connections. Never print or commit their values. Environment files are ignored; changing sensitive configuration requires approval.
4. Check the [database deployment requirements](docs/database-design.md#developer-reference). Ordinary setup must not initialize/reset the database, apply migrations or upgrade Prisma. The configured database has reported migration evidence, but another environment must be checked independently before running this code.
5. Start the development server:

   ```powershell
   npm run dev
   ```

   Open the local address printed by Next.js. Register an owner account, then sign in to create a group. Use separate browser profiles to try distinct guest identities.

On Windows, use `npm.cmd` or `npx.cmd` if PowerShell blocks the `.ps1` wrappers. Production build/start commands are `npm run build` and `npm run start`. Builds may need network access for the existing Google Fonts. Verification commands and their scope are in [tests.md](docs/tests.md#commands).

## Automated checks

[GitHub Actions CI](.github/workflows/ci.yml) runs on pushes to `main`, pull requests targeting `main` (including updates), and manual dispatch. Five checks run on Ubuntu with Node 24: isolated automated tests, lint, TypeScript, a production build, and the 26 real PostgreSQL integration tests against a disposable PostgreSQL 18 cluster. Dependencies come from `npm ci` with lockfile-based npm caching.

Failures appear as failed checks on the pull request and in the repository's Actions tab, with a named failing step and its log. CI does not use application database credentials, deploy the application, or verify browser journeys, production cookies or the live database. The first GitHub-hosted run still needs verification after pushing; a README status badge will be added only after a successful run. See [CI details and verification](docs/tests.md#github-actions-ci).

With dependencies installed, run from the repository root:

```powershell
node --test tests/*.test.mjs
npx.cmd --no-install tsc --noEmit --incremental false
npm.cmd run lint
npm.cmd run build
git diff --check
```

Use `npm`/`npx` instead of the `.cmd` wrappers outside Windows. There is no `npm test` script. The first command uses isolated database/framework doubles; it does not establish real PostgreSQL or browser behaviour. The separate `npm run test:integration` suite requires the guarded disposable database described in [tests.md](docs/tests.md#real-postgresql-integration-suite). Never substitute the application database. See that document for dated results and remaining manual checks.

## Reading guide

| Document | Read or update it for |
| --- | --- |
| [Architecture](docs/architecture.md) | Owner/guest journeys, permissions, expenses, balances, repayments and deletion rules |
| [Database design](docs/database-design.md) | Stored information, relationships, history protection and developer migration procedures |
| [Roadmap](docs/dev-roadmap.md) | Completed capabilities, limitations, agreed priorities and unprioritised ideas |
| [Testing](docs/tests.md) | Commands, coverage, reported evidence and outstanding checks |
| `agents.md` (local repository instructions) | Agent permissions, approval requirements and development safeguards |

The local instruction file keeps its existing lowercase filename and ignore policy; it is not a published repository link. Update each document only when its responsibility changes. Do not repeat milestone histories here.
