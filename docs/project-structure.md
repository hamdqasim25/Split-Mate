## Current Project Structure

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