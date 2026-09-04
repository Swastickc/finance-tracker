# PROJECT_SPEC.md — Personal Finance Portal

## 1. SOURCE OF TRUTH

This project has three levels of truth:

1. **The user's supplied transaction Excel exports** = authoritative historical transaction data.
2. **The existing repository/code** = authoritative current implementation state.
3. **This file (`PROJECT_SPEC.md`)** = authoritative product/architecture requirements.

`CONTEXT.md` is the recovery file explaining project state and constraints.

### Transaction files currently supplied

- `OpTransactionHistory04-09-2026.xls`
  - Detailed bank statement
  - Export period: 01/09/2025 → 31/08/2026
  - Transaction-level withdrawal, deposit, balance and transaction-remark data.

- `Newopstrans.xls`
  - Detailed bank statement
  - Export period: 06/08/2026 → 04/09/2026
  - Transaction-level withdrawal, deposit, balance and transaction-remark data.

A third transaction Excel export is expected to be supplied later. When supplied, it becomes part of the authoritative historical dataset and must be reconciled with the other exports.

### Critical data rule

Do NOT invent, estimate, or hallucinate historical:
- transactions
- amounts
- dates
- balances
- merchants
- income
- expenses

The application may normalize source data into merchant/category/type fields, but must preserve the original transaction remarks and source fields.

`report.xlsx` from the earlier workflow contains email sender/activity metadata. It is useful for Gmail-source discovery but is NOT transaction-level financial data and must never be treated as such.

---

## 2. PRODUCT VISION

Build a private personal finance portal that automatically logs, categorizes, analyzes, and explains personal transactions.

UX goals:
- Apple-inspired, not a literal Apple clone
- Minimal
- Calm
- Premium
- Mobile-first
- Fast
- Accessible

Primary target: iPhone/mobile browser.
Secondary target: desktop.

Core areas:
- Overview
- Transactions
- Review
- Analytics
- Settings
- Data Quality
- Import History

---

## 3. EXISTING SMS SYSTEM — DO NOT BREAK

The existing SMS extraction system already detects debit/spending SMS messages and feeds them into Google Sheets.

Do NOT rebuild or replace it.

The portal must consume the existing transaction data.

Architecture must remain source-agnostic:

```text
SMS ───────────────┐
Gmail ─────────────┤
Manual ────────────┤→ Normalized transaction layer → Portal
Future APIs ───────┘
```

---

## 4. V1 ARCHITECTURE

Frontend:
- React / Next.js
- TypeScript
- Existing project stack should be preferred if already established.

Hosting:
- Cloudflare-compatible deployment.

V1 data source:
- Google Sheets.

Existing:
```text
SMS → Google Sheets
```

Historical:
```text
Gmail → importer → Google Sheets
```

Keep UI, business logic, data access, and integrations separated.

---

## 5. CANONICAL TRANSACTION MODEL

Suggested fields:

```text
id
transaction_date
transaction_time
amount
currency
type
merchant
raw_description
category
subcategory
account
payment_method
source
source_message_id
status
confidence
is_recurring
rule_id
created_at
updated_at
```

Types:

```text
expense
income
refund
transfer
```

Statuses:

```text
confirmed
review
ignored
```

Sources:

```text
sms
gmail
manual
import
```

Always preserve raw source information.

---

## 6. HISTORICAL EXCEL IMPORT / RECONCILIATION

The bank Excel files are the baseline dataset for the application's historical calculations and validation.

The importer/data preparation layer must:

1. Parse the transaction-level rows.
2. Normalize dates and numeric amounts.
3. Preserve transaction remarks/reference values.
4. Determine withdrawal vs deposit.
5. Preserve balance information where available.
6. Track source filename.
7. Detect overlapping exports.
8. Deduplicate conservatively.
9. Retain provenance.
10. Produce repeatable imports.

The two supplied exports overlap in August 2026.

Do NOT blindly append both.

Preferred deduplication:
1. Strong transaction/reference identifier when available.
2. Date + amount + transaction remark/reference.
3. Additional account/payment context.
4. Conservative fallback matching.

If uncertain, keep the record and flag it rather than silently deleting it.

---

## 7. GMAIL IMPORTER

Support:

```text
SCAN
DRY RUN
IMPORT
```

SCAN:
- identify likely transaction senders
- sender domains
- message volume
- date ranges
- candidate messages

DRY RUN:
- parse without writing
- show amount, merchant, type, category, confidence and warnings

IMPORT:
- write validated transactions

Do not guess email structures.

Inspect real messages before implementing parsers.

Use semantic amount anchors such as:
- debited
- spent
- paid
- credited
- received
- transaction amount
- total amount

Account for Gmail threading and use message IDs for deduplication where possible.

---

## 8. MERCHANT NORMALIZATION

Preserve:

```text
raw_description
merchant
```

UPI payee/merchant information should be preferred when reliable.

Merchant normalization should be deterministic and rule-based where possible.

Examples:

```text
Amazon → Amazon
Zomato → Zomato
Rapido → Rapido
Prime Video → Prime Video
```

Do not turn arbitrary personal UPI recipients into commercial merchants without evidence.

---

## 9. CATEGORIES

Initial categories:

```text
Food
Transport
Shopping
Bills
Entertainment
Health
Travel
Subscriptions
Salary
Other
Uncategorized
```

Possible subcategories:

```text
Food:
  Restaurants
  Delivery
  Groceries
  Cafes

Transport:
  Cab
  Auto
  Metro
  Fuel

Shopping:
  Amazon
  Clothing
  Electronics
```

Keep V1 simple.

---

## 10. TRANSFERS / REFUNDS / INCOME

A transfer between the user's own accounts is NOT income.

Refunds are not ordinary income.

Transfers should generally be excluded from spending totals.

Salary/income should be tracked separately.

Never classify a transaction as income merely because money entered the account.

---

## 11. RULE ENGINE

Deterministic rules come before AI.

Example:

```text
Amazon → Shopping
Zomato → Food
Rapido → Transport
Prime Video → Subscriptions
```

Rules should support:

```text
rule_id
pattern
merchant
category
subcategory
priority
enabled
created_at
updated_at
```

User corrections should be remembered.

---

## 12. DEDUPLICATION

SMS and Gmail may represent the same transaction.

Preferred order:
1. source message ID
2. strong transaction/reference ID
3. date + amount + merchant/reference
4. time proximity

Never silently delete uncertain matches.

---

## 13. DASHBOARD

Show:

- Current monthly spending
- Previous-period comparison
- Category summary
- Recent transactions
- Uncategorized amount
- AI insight

Example:

```text
₹28,420
This month

↑ 17.9% vs last month
```

---

## 14. TRANSACTIONS

Support:
- search
- filters
- sorting
- date range
- category
- merchant
- type
- source
- status

Transaction display:

```text
Merchant
Date/time
Category
Amount
Type
Source
```

---

## 15. REVIEW QUEUE

Surface:
- unknown merchants
- uncategorized transactions
- low-confidence parsing
- possible duplicates
- possible transfers
- possible refunds

Actions:

```text
Confirm
Edit
Categorize
Create rule
Ignore
```

Mobile review must be fast.

---

## 16. ANALYTICS

Support:
- daily/weekly/monthly spending
- category totals
- category percentages
- month-over-month changes
- top merchants
- merchant trends
- income
- transfers
- recurring expenses

---

## 17. DATA QUALITY

Diagnostics:
- uncategorized transactions
- unknown merchants
- duplicate candidates
- missing dates
- missing amounts
- invalid types
- low-confidence imports
- failed parsing
- import errors

---

## 18. IMPORT HISTORY

Track:

```text
import_id
source
started_at
completed_at
messages_scanned
transactions_detected
transactions_imported
duplicates
errors
status
```

---

## 19. FINANCE AI

AI is NOT the financial source of truth.

Use:

```text
Transactions
  ↓
Deterministic calculations
  ↓
Structured financial metrics
  ↓
Privacy filtering
  ↓
LLM
  ↓
Explanation
```

Possible questions:
- Where did I spend the most this month?
- Why did spending increase?
- How much did I spend on food?
- What are my recurring expenses?
- Which merchants cost me the most?
- Is weekend spending higher?
- What is projected month-end spending?
- What changed versus last month?

The AI must never invent:
- transactions
- amounts
- dates
- merchants
- balances
- trends

If data is insufficient, say so.

Use an AI provider abstraction so providers can be changed later.

---

## 20. SECURITY / PRIVACY

Never:
- hard-code API keys
- commit `.env`
- expose Google credentials to frontend
- log unnecessary financial data
- send unnecessary raw financial data to an LLM
- let AI silently modify transactions

Use environment secrets and server-side privileged operations.

Require explicit user action for destructive changes.

---

## 21. UI / DESIGN

Apple-inspired, not copied.

Use:
- generous whitespace
- strong typography
- subtle borders
- rounded surfaces
- restrained shadows
- clear hierarchy
- subtle motion
- polished loading/error/empty states

Avoid:
- dashboard clutter
- excessive gradients
- excessive glass effects
- unnecessary animation
- desktop-only dense tables

---

## 22. ACCESSIBILITY

Support:
- semantic HTML
- keyboard navigation
- labels
- focus states
- sufficient contrast
- reduced motion
- screen-reader-friendly controls
- adequate touch targets

---

## 23. DEVELOPMENT PHASES

### Phase 0 — Repository Audit
Inspect existing framework, components, integrations, SMS pipeline, configuration, tests and deployment.

### Phase 1 — Frontend Foundation
Build app shell, navigation, responsive layout, design tokens, reusable UI primitives, dashboard skeleton and states.

### Phase 2 — Dashboard
Connect spending totals, comparisons, categories, recent transactions and insight placeholder.

### Phase 3 — Transactions
Search, filters, sorting, detail view and editing.

### Phase 4 — Review
Review queue, corrections, rules and duplicate handling.

### Phase 5 — Historical Data + Google Sheets
Parse/reconcile the supplied Excel exports, validate calculations, then connect the Google Sheets source.

### Phase 6 — Gmail Importer
SCAN → DRY RUN → IMPORT.

### Phase 7 — Analytics
Trends, categories, merchants, income, transfers and recurring expenses.

### Phase 8 — Finance AI
Deterministic metric engine → structured context → privacy filter → LLM.

### Phase 9 — Production Hardening
Security, validation, error handling, performance, accessibility and Cloudflare deployment.

---

## 24. COPILOT RULES

Before coding:
1. Read `PROJECT_SPEC.md`.
2. Read `CONTEXT.md`.
3. Inspect the repository.
4. Identify what already exists.
5. Do not assume missing architecture.

During coding:
- Do not break SMS ingestion.
- Do not invent transaction data.
- Do not treat sender metadata as transactions.
- Do not invent APIs or environment variables.
- Do not hard-code secrets.
- Keep data access separate from UI.
- Keep financial calculations deterministic.
- Keep AI behind a provider abstraction.
- Avoid unrelated rewrites.
- Only implement the requested phase.

After meaningful changes:

```text
lint
typecheck
tests
```

Fix issues introduced by the implementation.

Update README when setup changes.

---

## 25. MASTER COPILOT PROMPT

Read `PROJECT_SPEC.md` and `CONTEXT.md` completely.

Inspect the repository before changing anything.

The supplied transaction Excel exports are the authoritative historical dataset. The existing SMS-to-Google-Sheets pipeline is already working and must not be replaced.

Start with Phase 0 and Phase 1 only unless explicitly instructed otherwise.

Build using the existing project stack where practical.

Use mock data only where real integration is not yet available.

Do not invent financial records, APIs, credentials, environment variables, or historical facts.

Create clean abstractions so the portal can later consume Google Sheets, Gmail and SMS data through a normalized transaction model.

Run lint, typecheck and tests after implementation.

Summarize changes and stop after the requested phase.
