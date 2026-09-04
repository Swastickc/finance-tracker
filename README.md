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
npm test          # Vitest — deterministic parser/reconciliation tests
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
    gmail/                # Gmail OAuth client, semantic-anchor parser, SCAN/DRY RUN/IMPORT providers,
                          # scanState.ts (incremental-scan message tracking)
    bank/                 # bank-statement importer: xlsx reader, date/row parser, normalizer,
                          # overlap reconciliation, upload/dry-run/import server actions
    sms/                  # classifySmsText: deterministic TRANSACTION/NON_TRANSACTION/UNKNOWN
                          # classifier (OTP, due reminders, credit-card payments, etc.)
    canonical/             # cross-source dedup (findCrossSourceDuplicates), shared app-owned
                          # sheet schema (transactionToRow/rowToTransaction)
    data/analytics.ts     # deterministic trends/category/merchant/income/recurring aggregation
    data/dataQuality.ts   # deterministic Data Quality diagnostics
    ai/                   # context builder (redacted metrics), AIProvider abstraction + 4 providers
    auth/                 # password gate: signed session tokens, login/logout actions
    rateLimit.ts, requestIdentity.ts
    date.ts, format.ts, cn.ts, nav.ts
src/proxy.ts             # auth gate (Next.js "proxy"/middleware convention)
open-next.config.ts, wrangler.jsonc  # Cloudflare Workers deployment (OpenNext)
vitest.config.mts        # test runner config (src/**/*.test.ts)
```

## Status

Phases 0–9 are complete, plus a real-data-integration pass:

- **Bank statement import**: upload .xls/.xlsx (known 8-column schema:
  S No./Value Date/Transaction Date/Cheque Number/Transaction Remarks/
  Withdrawal/Deposit/Balance), parsed and reconciled before writing, dry-run
  preview, conservative overlap detection across statements (exact match =
  auto-ignored but retained; ambiguous match = flagged, never deleted).
  Deposits are never auto-classified as income (project-spec-truth.md rule);
  they're a low-confidence placeholder that always needs Review.
- **SMS semantic classifier** (`src/lib/sms/classify.ts`): deterministic
  TRANSACTION/NON_TRANSACTION/UNKNOWN classification tested against the 6
  literal SMS examples from project-spec-truth.md (ICICI debit/credit, HDFC
  purchase/OTP/credit-card-payment/due-reminder) — OTPs and due reminders are
  correctly excluded, credit-card payments are transfers not income.
- **Cross-source deduplication** (`src/lib/canonical/reconcile.ts`): flags
  same date+amount transactions across bank/SMS/Gmail as possible duplicates
  without ever merging or deleting; surfaced in the new Data Quality page.
- **Gmail incremental scanning**: SCAN now reports which messages are new
  vs. previously seen (in-memory only — see code comments for the
  production-persistence gap).
- **Tests**: 32 Vitest tests (`npm test`) covering all 15 required scenarios
  (SMS classification ×6, OTP+purchase dedup, bank-statement overlap,
  bank+Gmail dup, bank+SMS dup, own-account transfer, refund, unknown SMS,
  unknown Gmail, malformed row).

Earlier phases (frontend, dashboard, transactions, review, analytics,
Finance AI, auth/security hardening, Cloudflare deployment) are unchanged.
The default AI provider is a template (no API key, cannot hallucinate);
`openai`/`gemini` are implemented and just need an API key. The Sheets read
path, Gmail importer, and bank importer are all real, tested code but
unverified against actual credentials/inboxes/statement files — none were
available in this environment (mock remains the default for all three). See
`PROJECT_SPEC.md` §28 and `project-spec-truth.md` for the full requirements.

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

- `APP_ACCESS_PASSWORD`, `SESSION_SECRET` — optional. Leave both unset for
  zero-config local dev (no login gate). Set both to require a password
  before anyone can view the app (e.g. before deploying it publicly).

## Deploying to Cloudflare Workers

```bash
npm run cf:build     # builds via @opennextjs/cloudflare
npm run cf:preview   # build + local preview under workerd
npm run cf:deploy     # build + wrangler deploy
```

Set secrets with `wrangler secret put <NAME>` (e.g. `SESSION_SECRET`,
`APP_ACCESS_PASSWORD`, `OPENAI_API_KEY`) rather than committing them.
`@cloudflare/next-on-pages` doesn't support Next.js 16 yet (peer dependency
caps at 15.5.2, confirmed via `npm install`), so Cloudflare Workers AI
(`AI_PROVIDER=cloudflare`) isn't wired — use `template`, `openai`, or `gemini`.
The build logs a "Node.js middleware support is experimental in cloudflare"
warning for the auth proxy — it only uses Web Crypto/fetch (no Node-only
APIs), so this is OpenNext being cautious, not a known incompatibility.
