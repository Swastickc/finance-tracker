# CONTEXT.md — Personal Finance Portal Recovery File

## READ THIS FIRST IF CHAT CONTEXT IS LOST

Read both:

```text
PROJECT_SPEC.md
CONTEXT.md
```

Then inspect the repository.

`PROJECT_SPEC.md` is the product/architecture source of truth.
`CONTEXT.md` is the project-state/recovery source of truth.
The repository is the implementation source of truth.
The user's transaction Excel exports are the historical financial-data source of truth.

---

## USER'S CURRENT PLAN

The user wants GitHub Copilot to perform the bulk of implementation.

Workflow:

```text
PROJECT_SPEC.md + CONTEXT.md
        ↓
GitHub Copilot builds
        ↓
User pushes to GitHub
        ↓
ChatGPT checks the actual repository
        ↓
ChatGPT identifies bugs/security/finance/architecture issues
        ↓
Copilot fixes
        ↓
User pushes again
        ↓
ChatGPT re-reviews
```

Do not assume code exists until the repository is inspected.

---

## AUTHORITATIVE HISTORICAL DATA

The user has supplied bank transaction Excel exports.

Currently supplied:

### `OpTransactionHistory04-09-2026.xls`

Detailed transaction statement.

Export period:
```text
01/09/2025 → 31/08/2026
```

Observed transaction columns include:
```text
S No.
Value Date
Transaction Date
Cheque Number
Transaction Remarks
Withdrawal Amount(INR)
Deposit Amount(INR)
Balance(INR)
```

### `Newopstrans.xls`

Detailed transaction statement.

Export period:
```text
06/08/2026 → 04/09/2026
```

It uses the same transaction-level structure.

### Third transaction Excel

The user intends to provide a third transaction Excel file.

When it arrives:
- treat it as authoritative
- add it to the canonical source set
- reconcile it against existing exports
- detect overlap
- deduplicate conservatively
- preserve source provenance

---

## CRITICAL DATA RULE

These transaction exports are real transaction-level source data.

Never invent:
- amounts
- dates
- balances
- transaction rows
- merchant identities
- income
- expenses

Do not use an LLM to fill missing financial facts.

Normalize only what the source supports.

Always retain raw transaction remarks/source fields.

---

## OVERLAPPING EXPORTS

The supplied statements overlap in August 2026.

Therefore:

```text
Do NOT:
file A rows + file B rows = database
```

Instead:

```text
file A
   +
file B
   ↓
normalize
   ↓
identify overlap
   ↓
deduplicate
   ↓
retain provenance
   ↓
canonical historical dataset
```

Use transaction/reference identifiers where available.

Fallback:
```text
date + amount + transaction remark/reference
```

If uncertain, flag rather than delete.

---

## EARLIER `report.xlsx`

An earlier Excel file called `report.xlsx` contains email sender/activity metadata.

Examples of identified services include:
- Amazon
- Amazon Pay
- Zomato
- Reliance Digital
- Rapido
- Flipkart
- AJIO Luxe
- Myntra
- Shopify
- Stake
- Prime Video
- Shiprocket
- Ola Cabs
- District
- Xiaomi
- Swiggy
- OlaMoney
- Razorpay
- Snitch

This file is NOT a transaction database.

It can help identify Gmail sender patterns for historical email import.

Never convert email counts into spending amounts.

---

## EXISTING SMS PIPELINE

The SMS extraction system already detects debit/spending SMS messages and feeds them into Google Sheets.

This is a working system.

### Never replace it.

The portal must integrate with it.

---

## EXPECTED ARCHITECTURE

```text
SMS ───────────────┐
Gmail ─────────────┤
Manual ────────────┤
Future APIs ───────┘
          ↓
Normalized Transaction Model
          ↓
Deterministic Finance Engine
          ↓
Portal UI
          ↓
AI Explanation Layer
```

V1 storage/integration target:
```text
Google Sheets
```

Cloudflare is the intended hosting environment.

The user already has a Cloudflare account.

Do not assume specific Cloudflare services or environment variables without inspecting the repository.

---

## FINANCE CORRECTNESS

Transaction types:

```text
expense
income
refund
transfer
```

Important:
- own-account transfers are not income
- refunds are not normal income
- transfers should generally not count as spending
- financial arithmetic must be deterministic
- AI explains calculated metrics rather than calculating authoritative totals

---

## AI DESIGN

Correct:

```text
raw transactions
      ↓
deterministic calculations
      ↓
structured metrics
      ↓
privacy filtering
      ↓
LLM
      ↓
insight/explanation
```

Incorrect:

```text
raw transactions → LLM → financial totals
```

AI must not invent financial facts.

---

## PRODUCT STYLE

Mobile-first personal finance portal.

Design:
- Apple-inspired
- minimal
- premium
- calm
- clean
- accessible

Main sections:
```text
Overview
Transactions
Review
Analytics
Settings
Data Quality
Import History
```

---

## DEVELOPMENT ORDER

1. Repository audit
2. Frontend foundation
3. Dashboard
4. Transactions
5. Review workflow
6. Historical Excel reconciliation + Google Sheets
7. Gmail importer
8. Analytics
9. Finance AI
10. Production hardening

Do not skip directly to complex AI/backend work unless requested.

---

## COPILOT RECOVERY INSTRUCTION

If the user says "continue" after context has been lost:

1. Read `PROJECT_SPEC.md`.
2. Read `CONTEXT.md`.
3. Inspect current git status/files.
4. Determine which phase is actually implemented.
5. Do not redo completed work.
6. Do not assume prior chat decisions not represented in these files.
7. Continue from the repository's actual state.

---

## REVIEW BY CHATGPT

After the user pushes the repository, ChatGPT should inspect the actual code and review:

### Architecture
- separation of UI/data/business logic
- maintainability
- unnecessary rewrites

### Financial correctness
- expense/income/refund/transfer logic
- deterministic calculations
- duplicate handling
- historical Excel reconciliation

### Data integrity
- raw source preservation
- provenance
- overlap handling
- import repeatability

### Security
- credentials
- secrets
- Google access
- server/client boundaries
- sensitive logs

### AI
- grounded metrics
- hallucination risk
- provider abstraction
- privacy filtering

### UI
- mobile usability
- Apple-inspired polish
- accessibility
- loading/error/empty states

### Deployment
- Cloudflare compatibility
- production configuration
- error handling

---

## NON-NEGOTIABLES

Never:
- fabricate historical financial data
- break the SMS pipeline
- treat sender metadata as transaction records
- let AI become the financial source of truth
- commit secrets
- expose private credentials
- silently delete uncertain duplicates
- perform unrelated giant rewrites

---

## D1 PROVISIONING — IN PROGRESS, BLOCKED ON NETWORK (2026-09-05)

Task: provision the real `GMAIL_SCAN_STATE_DB` D1 database (see `src/lib/gmail/scanState.ts`
and `src/lib/gmail/scanState.sql`). Nothing else was touched — no Gmail scan,
no Sheets writes, no bank/SMS/classification changes.

Done so far (on a machine behind a corporate VPN/proxy):
1. `npx wrangler whoami` confirmed authenticated (account
   `Chowdhuryswastick@gmail.com's Account`).
2. `npx wrangler d1 create finance-tracker-gmail-scan-state` succeeded.
   - database_name: `finance-tracker-gmail-scan-state`
   - database_id: `99207ca2-d612-46d2-aa42-98ea65e261af`
   - region: APAC
3. `wrangler.jsonc` `d1_databases[0].database_id` updated from
   `REPLACE_WITH_REAL_D1_DATABASE_ID` to the real id above. Binding name kept
   as `GMAIL_SCAN_STATE_DB` (declined wrangler's suggested auto-binding name).

Blocked:
- `npx wrangler d1 execute finance-tracker-gmail-scan-state --remote --file=src/lib/gmail/scanState.sql`
  fails after upload with `[ERROR] fetch failed`, preceded by wrangler's own
  warning: "detected that a corporate proxy or VPN might be enabled on your
  machine, resulting in API calls failing due to a certificate mismatch."
  This is a local network/TLS issue, not a code or schema problem. Retried
  twice, same failure both times.

Remaining steps (do these next, from a network without the proxy/VPN issue):
1. `npx wrangler d1 execute finance-tracker-gmail-scan-state --remote --file=src/lib/gmail/scanState.sql`
2. Verify the table exists, e.g.:
   `npx wrangler d1 execute finance-tracker-gmail-scan-state --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='gmail_scan_state';"`
3. Run lint, typecheck, all tests, and build.
4. Commit and push only the D1 infra/config changes (`wrangler.jsonc`, this
   file). Do not touch Gmail classification, bank ingestion, or SMS→Sheets
   code.
5. Report: database name, database id, migration result, binding,
   verification output, commit hash, push result.
