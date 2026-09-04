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
- Data layer backed by a swappable `TransactionProvider`
  (`src/lib/data/provider.ts`): mock data by default, or Google Sheets via the
  REST API (Web Crypto service-account auth, no Node-only SDKs) when
  `DATA_SOURCE=sheets` — see Environment variables below

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
    data/
      transactions.ts     # data-access layer (calls the active provider)
      provider.ts         # picks mock vs. Google Sheets via DATA_SOURCE
      providers/          # MockTransactionProvider, GoogleSheetsTransactionProvider
    sheets/               # Sheets REST client, service-account auth, row mapping
    format.ts, cn.ts, nav.ts
```

## Status

Phases 0–5 are complete: frontend foundation, dashboard, transactions (search/
filter/sort/edit), review queue (confirm/edit/rule creation/ignore), and a
Google Sheets data-access layer (opt-in, mock remains the default). The Sheets
integration is scaffolded but unverified against the real spreadsheet — its
column mapping is a placeholder pending confirmation (see Environment
variables). Later phases (Gmail importer, analytics, Finance AI, production
hardening) are not yet implemented — see `PROJECT_SPEC.md` §28 for the phase
plan.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values only if switching on
the Google Sheets integration:

- `DATA_SOURCE` — `mock` (default) or `sheets`.
- `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY` — a read-only
  service account with access to the existing SMS → Sheets spreadsheet.
- `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_TRANSACTIONS_RANGE` — the
  spreadsheet ID and the A1 range of the transactions tab.

The column headers `src/lib/sheets/mapRow.ts` expects mirror the unified
schema field names from `PROJECT_SPEC.md` §5 (`transaction_date`, `amount`,
`raw_description`, etc.) — **this must be confirmed against the real,
existing sheet before turning on `DATA_SOURCE=sheets`**; the app was not
guessing real credentials or schema, only scaffolding the integration.
Never commit `.env`/`.env.local`.
