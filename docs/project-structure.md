# SPLITMate Project Structure

## Implementation and testing update - 19 September 2026

This section records the current implementation and its testing results. Original notes are preserved separately below as historical material; their older plans and status statements are not current behaviour.

### Completed - current source map

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Landing page with server-side authentication-aware actions |
| `src/app/login/page.tsx`, `src/app/register/page.tsx` | Auth pages with validated return destinations |
| `src/components/auth/auth-form.tsx` | Login/register form, validation, pending/error states and navigation |
| `src/app/dashboard/page.tsx` | Owner guard and persisted group/activity dashboard |
| `src/app/groups/new/page.tsx` | Owner guard and group creation page |
| `src/components/groups/create-group-form.tsx` | Authenticated group submission UI |
| `src/app/api/groups/route.ts` | Session-derived owner, JSON/origin validation and creation response |
| `src/app/api/auth/register/route.ts` | Account creation POST endpoint |
| `src/app/api/auth/login/route.ts` | Credential verification and owner session issuance |
| `src/app/api/auth/logout/route.ts` | POST-only session revocation |
| `src/data/auth.ts` | Account validation and bcrypt password handling |
| `src/data/groups.ts` | Transactional createGroup and owner-scoped getGroupsForOwner |
| `src/lib/auth/session.ts` | UserSession creation, resolution and revocation |
| `src/lib/auth/http.ts`, `src/lib/auth/errors.ts` | Safe auth responses, request protection and errors |
| `src/prisma/db.ts` | Prisma-hosted PostgreSQL runtime client |
| `src/prisma/contract.prisma` | Authored nine-model data contract |
| `src/prisma/contract.json`, `src/prisma/contract.d.ts` | Generated contract artifacts; do not hand-edit |
| `migrations/app/` | Three migration packages and migration refs |
| `migrations/snapshots/` | Historical contract snapshots |
| `tests/auth-pages.test.mjs` | 38 page/form tests, including mocked persisted dashboard data |
| `tests/dashboard.test.mjs` | 18 read-service and dashboard tests |
| `tests/create-group.test.mjs` | 32 transactional creation tests |
| `tests/auth.test.mjs` | 32 auth/service/session/route tests |
| `tests/helpers/` | Local database/session doubles |
| `docs/` | Public status, architecture, requirements, roadmap and historical diagrams |

Next.js layout/styles remain in `src/app/layout.tsx` and `src/app/globals.css`. Tool versions and scripts are defined in `package.json` and the lockfile. Private environment files, local agent instructions, dependencies and build output are ignored by Git.

### Next

An owner group detail page and dashboard card links, group members/activity views, share controls, `/g/[shareToken]` and guest claiming. There is no `/groups` index or owner group detail route yet. See the [roadmap](dev-roadmap.md).

### Future

Expense, balance and repayment handlers/UI, plus optional account linking. Existing database models do not imply existing pages or workflows.

---

<details>
<summary>Historical original notes - not current implementation</summary>

## Original notes — preserved

The following notes are retained as originally written. For current implementation status, use the dated update above.


```text
Split-Mate/
│
├── docs/
│   ├── images/
│   ├── architecture.md
│   ├── database-design.md
│   ├── dev-roadmap.md
│   ├── progress-report.md
│   ├── progress-structure.md
│   ├── requirements.md
│   └── user-stories.md
│
├── migrations/
│
├── src/
│   ├── app/
│   │   ├── api/
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   │
│   │   ├── groups/
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   │
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   └── prisma/
│       ├── contract.prisma
│       ├── contract.json
│       ├── contract.d.ts
│       └── db.ts
│
├── .env
├── .gitignore
├── next.config.ts
├── package.json
├── package-lock.json
├── prisma.config.ts
├── README.md
└── tsconfig.json
```

</details>
