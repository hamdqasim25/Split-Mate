## Current Project Structure

## Implementation and testing notes — 17 September 2026

This inventory was added during implementation and testing. It shows files actually present after the backend group-creation work. The original structure is preserved below and includes historical paths that no longer exist.

```text
Split-Mate/
├── docs/
│   ├── images/                    Original design images
│   ├── architecture.md
│   ├── database-design.md
│   ├── dev-roadmap.md
│   ├── group-creation.md          Backend inputs, transaction and limitations
│   ├── progress-report.md
│   ├── project-structure.md
│   ├── requirements.md
│   └── user-stories.md
├── migrations/
│   ├── app/                       Applied migration history and refs
│   └── snapshots/                 Generated historical contracts
├── public/
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx      Sample dashboard
│   │   ├── groups/new/page.tsx     Form UI without submission wiring
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                Landing page
│   ├── data/
│   │   └── groups.ts              Server-only transactional creation service
│   └── prisma/
│       ├── contract.prisma        Authored contract
│       ├── contract.json          Generated
│       ├── contract.d.ts          Generated
│       └── db.ts                  Existing Prisma PostgreSQL client
├── tests/
│   ├── create-group.test.mjs       32 service unit tests
│   └── helpers/
│       └── group-database.mjs      In-memory transaction double
├── .gitignore
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── prisma.config.ts
├── prisma-next.md
├── README.md
└── tsconfig.json
```

There is no `src/app/api/`, `src/lib/`, authentication module or `/g/[shareToken]` route yet. The former `/api/test-db` route is absent. `docs/progress-structure.md` in the original tree is not an existing file.

Private environment files and the local agent instructions are excluded from version control. Generated build output, dependencies and installed AI/tooling skills are also ignored.

The test helper replaces only the database dependency; the production service continues to import the existing `src/prisma/db.ts` client. See [group-creation.md](group-creation.md) for execution instructions.

---

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