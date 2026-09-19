# SPLITMate Project Structure

## Current source map

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Session-aware landing page |
| `src/app/login/`, `src/app/register/` | Owner authentication pages |
| `src/app/api/auth/` | Registration, login and logout POST endpoints |
| `src/app/actions/auth.ts` | Owner sign-out action |
| `src/app/dashboard/page.tsx` | Protected persisted owner dashboard |
| `src/app/groups/new/page.tsx` | Protected group creation page |
| `src/app/groups/[groupId]/page.tsx` | Owner-only group detail |
| `src/app/api/groups/route.ts` | Validated, session-derived group creation |
| `src/app/g/[shareToken]/page.tsx` | Invite/member selection and returning-guest redirect |
| `src/app/g/[shareToken]/group/page.tsx` | Protected guest group view |
| `src/app/g/[shareToken]/joined/page.tsx` | Compatibility redirect |
| `src/app/actions/guest.ts` | Guest claim and sign-out actions |
| `src/components/auth/auth-form.tsx` | Login/register interaction |
| `src/components/groups/create-group-form.tsx` | Group submission UI |
| `src/components/groups/share-link.tsx` | Owner share-link display/copy |
| `src/components/groups/claim-member-form.tsx` | Claim submission, pending/error states |
| `src/components/groups/guest-sign-out.tsx` | Device sign-out and claim-retention explanation |
| `src/data/auth.ts` | Account validation and password handling |
| `src/data/groups.ts` | Transactional creation, owner dashboard/detail reads |
| `src/data/invites.ts` | Minimal token lookup, safe invite data and atomic claims |
| `src/data/guest-groups.ts` | Authenticated guest data and activity tracking |
| `src/lib/auth/tokens.ts` | Shared secure token generation, validation and hashing |
| `src/lib/auth/session.ts` | Owner session lifecycle |
| `src/lib/auth/guest-session.ts` | Guest validation, cookies, activity and revocation |
| `src/lib/auth/http.ts`, `errors.ts` | HTTP validation and safe authentication errors |
| `src/prisma/db.ts` | PostgreSQL runtime |
| `src/prisma/contract.prisma` | Authored nine-model contract |
| `src/prisma/contract.json`, `contract.d.ts` | Generated artifacts; do not hand-edit |
| `migrations/` | Applied migration history, refs and snapshots |
| `tests/*.test.mjs`, `tests/helpers/` | Node tests and isolated runtime/database doubles |
| `docs/tests.md` | Permanent testing reference and checkpoints |

Layout/styles remain in `src/app/layout.tsx` and `globals.css`. Dependencies and scripts are defined in package.json and its lockfile. Environment secrets and build output remain ignored.

For route authorization see [architecture](architecture.md); for current feature status see [README](../README.md). No expense routes/workflows or `/groups` index exist.

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
