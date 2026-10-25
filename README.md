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

## Reading guide

| Document | Read or update it for |
| --- | --- |
| [Architecture](docs/architecture.md) | Owner/guest journeys, permissions, expenses, balances, repayments and deletion rules |
| [Database design](docs/database-design.md) | Stored information, relationships, history protection and developer migration procedures |
| [Roadmap](docs/dev-roadmap.md) | Completed capabilities, limitations, agreed priorities and unprioritised ideas |
| [Testing](docs/tests.md) | Commands, coverage, reported evidence and outstanding checks |
| `agents.md` (local repository instructions) | Agent permissions, approval requirements and development safeguards |

The local instruction file keeps its existing lowercase filename and ignore policy; it is not a published repository link. Update each document only when its responsibility changes. Do not repeat milestone histories here.
