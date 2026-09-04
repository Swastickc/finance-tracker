# Finance Tracker — Personal Finance Portal

A private, mobile-first personal finance portal. Consumes transactions from an
existing SMS → Google Sheets pipeline (not rebuilt here) and will add Gmail
import, analytics, and AI-grounded insights in later phases. See
[PROJECT_SPEC.md](./PROJECT_SPEC.md) for the full product spec and phased
roadmap.

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS v4 (design tokens in `src/app/globals.css`)
- lucide-react icons
- Data layer currently backed by mock data (`src/lib/mock-data.ts`), behind
  the same abstraction (`src/lib/data/transactions.ts`) that will later read
  from Google Sheets/Gmail

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev       # start dev server
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit  # type-check
```

## Project structure

```
src/
  app/                  # routes: Overview, Transactions, Review, Analytics,
                         # Settings, Data Quality, Import History
  components/
    ui/                 # reusable primitives: Card, Button, Badge, StatCard,
                         # Skeleton, EmptyState, ErrorState
    layout/             # AppShell, Sidebar (desktop), BottomNav (mobile)
    transactions/       # TransactionRow
  lib/
    types.ts             # unified, source-agnostic transaction schema
    mock-data.ts          # realistic mock transactions/rules/import history
    data/transactions.ts  # data-access layer (swap mock → real source here)
    format.ts, cn.ts, nav.ts
```

## Status

Phase 0 (repository audit) and Phase 1 (frontend foundation: app shell, nav,
design tokens, primitives, dashboard skeleton, loading/empty/error states) are
complete, using mock data. Later phases (Google Sheets integration, Gmail
importer, analytics, Finance AI) are not yet implemented — see
`PROJECT_SPEC.md` §28 for the phase plan.

## Environment variables

None required yet. When Google Sheets/Gmail/AI integrations are added, secrets
will be read from environment variables only (never committed) and a
`.env.example` will be provided.
