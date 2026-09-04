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
    ai/                   # context builder (redacted metrics), AIProvider abstraction + 4 providers
    auth/                 # password gate: signed session tokens, login/logout actions
    rateLimit.ts, requestIdentity.ts
    date.ts, format.ts, cn.ts, nav.ts
src/proxy.ts             # auth gate (Next.js "proxy"/middleware convention)
open-next.config.ts, wrangler.jsonc  # Cloudflare Workers deployment (OpenNext)
```

## Status

Phases 0–9 are complete: frontend foundation, dashboard, transactions (search/
filter/sort/edit), review queue (confirm/edit/rule creation/ignore), a Google
Sheets data-access layer, a Gmail historical importer (SCAN/DRY RUN/IMPORT),
analytics (spending trend, category/merchant month-over-month, income,
transfers, recurring-expense detection), Finance AI (deterministic metrics →
redacted context → provider-abstracted insight/Q&A), and production hardening:

- **Auth**: optional password gate (`APP_ACCESS_PASSWORD` + `SESSION_SECRET`),
  signed stateless session cookie, no-op when unset (tested both states).
- **Security headers**: CSP, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy` (verified on live responses).
- **Rate limiting**: in-memory sliding window on the Ask-AI and Gmail
  import actions (per-instance only — not distributed across edge isolates).
- **Input validation**: length caps on free-text fields and AI questions.
- **Error handling**: root `error.tsx` + `global-error.tsx` (root-layout
  crashes), Gmail/AI server actions return errors instead of throwing.
- **Accessibility**: skip-to-content link, `aria-label`s throughout,
  `prefers-reduced-motion` support, visible focus rings.
- **Cloudflare deployment**: builds successfully via `@opennextjs/cloudflare`
  (verified with `npm run cf:build`); `@cloudflare/next-on-pages` was tried
  first but doesn't support Next.js 16 yet, so the Workers AI provider
  (`AI_PROVIDER=cloudflare`) remains stubbed.

The default AI provider is a template (no API key, cannot hallucinate);
`openai`/`gemini` are implemented and just need an API key. The Sheets read
path and Gmail importer are scaffolded but unverified against real
credentials/inboxes (mock remains the default for both). See
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
