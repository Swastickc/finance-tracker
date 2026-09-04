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
    gmail/                # Gmail OAuth client, semantic-anchor parser, SCAN/DRY RUN/IMPORT providers
    data/analytics.ts     # deterministic trends/category/merchant/income/recurring aggregation
    date.ts, format.ts, cn.ts, nav.ts
```

## Status

Phases 0–7 are complete: frontend foundation, dashboard, transactions (search/
filter/sort/edit), review queue (confirm/edit/rule creation/ignore), a Google
Sheets data-access layer, a Gmail historical importer (SCAN/DRY RUN/IMPORT),
and analytics (spending trend, category/merchant month-over-month, income,
transfers, recurring-expense detection — all deterministic, no AI). Both the
Sheets read path and the Gmail importer are scaffolded but unverified against
real credentials/inboxes — the Gmail parser (`src/lib/gmail/parse.ts`) uses
the semantic-anchor technique from `PROJECT_SPEC.md` §7 against illustrative
fixtures only, not real emails (mock remains the default for both). Later
phases (Finance AI, production hardening) are not yet implemented — see
`PROJECT_SPEC.md` §28 for the phase plan.

## Environment variables

Copy `.env.example` to `.env.local` and fill in values only if switching on
the Google Sheets integration:

- `DATA_SOURCE` — `mock` (default) or `sheets`.
- `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY` — a read-only
  service account with access to the existing SMS → Sheets spreadsheet.
- `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SHEETS_TRANSACTIONS_RANGE` — the
  spreadsheet ID and the A1 range of the transactions tab.

The column layout `src/lib/sheets/mapRow.ts` expects is **positional, not
header-based** — the real sheet has no header row. Confirmed layout (2026-09-04):
column A datetime (`M/D/YYYY H:mm:ss`), B payee, C amount, D a free-text note/tag.
All imported rows default to `status: "review"` so they flow through the
Review queue for confirmation/categorization rather than being trusted blindly.
Never commit `.env`/`.env.local`.
