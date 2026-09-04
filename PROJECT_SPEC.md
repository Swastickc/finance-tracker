# PROJECT SPEC — Personal Finance Portal

## 1. Product Vision

Build a private personal finance portal that automatically collects, categorizes, analyzes, and explains personal transactions.

The product should feel:
- Apple-inspired
- Minimal
- Calm
- Premium
- Mobile-first
- Fast
- Easy to understand

Primary target: iPhone/mobile browser.
Secondary target: desktop browser.

The portal should provide:
1. A financial dashboard
2. Transaction history
3. Transaction review/categorization
4. Analytics
5. Data-quality diagnostics
6. AI-powered financial insights
7. Google Sheets integration
8. Historical Gmail transaction import
9. Compatibility with the existing SMS ingestion pipeline

---

# 2. IMPORTANT EXISTING SYSTEM

The hardest part is already solved.

There is an existing SMS extraction system that detects debit/spending SMS messages and feeds them into Google Sheets.

### Do NOT rebuild or replace the SMS ingestion system.

The portal must consume the existing transaction data.

Future architecture should support multiple sources:

- SMS
- Gmail
- Google Sheets
- Manual entries
- Future bank/API sources if needed

The data model should therefore be source-agnostic.

---

# 3. Historical Data

A historical Excel file exists containing sender/activity metadata from old email.

It is useful for identifying important senders and services, but it is NOT a complete transaction database.

Known high-volume senders/services include:

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

Do not assume the sender dump contains transaction amounts or complete transaction details.

Actual historical reconstruction requires access to the underlying email contents.

---

# 4. Core Architecture

Recommended V1 architecture:

Frontend:
- React / Next.js
- TypeScript
- Apple-inspired UI

Hosting:
- Cloudflare

Backend/API:
- Cloudflare-compatible server/API layer
- Keep data-access logic separated from UI

Database V1:
- Google Sheets

Existing ingestion:
- SMS → Google Sheets

Historical ingestion:
- Gmail → Google Apps Script → Google Sheets

AI:
- Provider abstraction
- Cloudflare Workers AI / OpenAI / Gemini can be swapped later

---

# 5. Unified Transaction Schema

All transaction sources should normalize into the same structure.

Suggested schema:

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

### Transaction type

Allowed values:

```text
expense
income
refund
transfer
```

### Source

Examples:

```text
sms
gmail
manual
import
```

### Status

Examples:

```text
confirmed
review
ignored
```

### Important rule

Always preserve the original/raw transaction information.

Never destroy the original description merely because a merchant/category was normalized.

---

# 6. Deduplication

SMS and Gmail may contain the same transaction.

Deduplication should be conservative.

Preferred matching order:

1. `source_message_id`
2. Strong transaction fingerprint
3. Date + amount + merchant + account/payment method
4. Time proximity when available

Do not silently delete transactions just because they look similar.

When uncertain, flag for review.

---

# 7. Gmail Historical Importer

The Gmail importer should support:

```text
SCAN
DRY RUN
IMPORT
```

### SCAN

Identify:
- likely transaction senders
- email volume
- candidate transaction messages
- sender domains
- date ranges

### DRY RUN

Parse messages without writing transactions.

Show:
- sender
- date
- detected amount
- merchant
- transaction type
- category
- confidence
- parsing warnings

### IMPORT

Write validated transactions to Google Sheets.

### Important

Do not guess email formats.

Inspect real email structures before building parsers.

Use semantic anchors around amounts rather than fragile assumptions such as "first number in email."

Examples of semantic anchors:

```text
debited
spent
paid
credited
received
transaction amount
total amount
```

---

# 8. Gmail Threading and Deduplication

Gmail can group related emails into threads.

Do not assume every thread represents one transaction.

Use message IDs for deduplication whenever possible.

Store the relevant message identifier in:

```text
source_message_id
```

Use the actual transaction timestamp/date when available, rather than blindly using email import time.

---

# 9. Merchant Extraction

Merchant extraction must be deterministic where possible.

Potential sources:
- UPI payee
- merchant field
- transaction description
- sender
- known merchant patterns

Normalize merchant names without losing raw data.

Example:

```text
raw_description = original bank/email/SMS text
merchant = normalized merchant name
```

Merchant normalization should allow rules to improve over time.

---

# 10. Categories

Initial category list:

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

Subcategories can be introduced later.

Examples:

```text
Food
  Restaurants
  Delivery
  Groceries
  Cafes

Transport
  Cab
  Auto
  Metro
  Fuel

Shopping
  Amazon
  Clothing
  Electronics
```

Do not overcomplicate the category system in V1.

---

# 11. Transfers, Refunds, and Income

This is financially important.

A transfer between the user's own accounts must NOT be treated as income.

Support:

```text
expense
income
refund
transfer
```

Refunds should not be treated as normal income.

Transfers should be separately visible and should generally be excluded from spending calculations.

Salary/income should be tracked separately from expenses.

---

# 12. Merchant and Category Rules

Use deterministic rules before AI.

Example:

```text
Amazon → Shopping
Zomato → Food
Rapido → Transport
Prime Video → Subscriptions
```

Rules should be editable.

Suggested rule structure:

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

The system should remember user corrections.

If a user repeatedly categorizes a merchant in the same way, the system should be able to create or suggest a rule.

---

# 13. AI Should Not Be the Source of Truth

Financial calculations must be deterministic.

The application should calculate metrics first.

Example:

```text
monthly_spend = ₹28,420
previous_month_spend = ₹24,100
change_percent = 17.9
food_spend = ₹7,840
uncategorized_spend = ₹1,230
projected_month_end_spend = ₹34,700
```

Then provide these structured metrics to the LLM.

The LLM explains the numbers.

It should NOT be responsible for raw arithmetic.

---

# 14. Finance AI

The portal should have an AI finance assistant.

Possible questions:

```text
Where did I spend the most this month?
Why did my spending increase?
How much did I spend on food?
What are my biggest recurring expenses?
Which merchants do I spend the most with?
Am I spending more on weekends?
How much am I projected to spend this month?
What changed compared with last month?
```

Example insights:

```text
Food spending is up 23% this month.

You are currently on track to spend about ₹34,700 this month.

Your Amazon spending is unusually high compared with your normal monthly pattern.

Weekend spending is 41% higher than your weekday average.
```

The AI must only make claims supported by supplied metrics/data.

It must not invent:
- transactions
- merchants
- amounts
- dates
- trends
- balances

---

# 15. AI Architecture

Use this pipeline:

```text
Transactions
      ↓
Deterministic calculations
      ↓
Structured financial metrics
      ↓
Privacy filtering/redaction
      ↓
LLM
      ↓
Explanation / insight
```

Create an AI provider abstraction.

Example concept:

```text
AIProvider
 ├── CloudflareWorkersAIProvider
 ├── OpenAIProvider
 └── GeminiProvider
```

The application should not be tightly coupled to one AI vendor.

---

# 16. Privacy

This is personal financial data.

Security and privacy are first-class requirements.

Rules:

- Never hard-code API keys
- Never commit `.env`
- Provide `.env.example`
- Use environment variables/secrets
- Do not expose Google credentials to the frontend
- Keep privileged APIs server-side
- Avoid sending unnecessary raw transaction data to an LLM
- Redact unnecessary personal information before AI processing
- Do not log sensitive financial data unnecessarily
- Do not allow AI to modify transactions automatically
- Require explicit user action for destructive changes

---

# 17. User Interface

Main navigation:

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

# 18. Dashboard / Overview

The overview should immediately answer:

### How much did I spend?

Example:

```text
₹28,420
This month
```

### Comparison

```text
↑ 17.9% vs last month
```

### AI insight

Example:

```text
Your food spending is unusually high this month.
```

### Category summary

Show major categories.

Example:

```text
Food          ₹7,840
Shopping      ₹6,210
Transport     ₹3,420
Bills         ₹4,100
Entertainment ₹2,200
Other         ₹3,420
```

### Uncategorized

Clearly surface:

```text
₹1,230 needs review
```

---

# 19. Transactions Screen

Features:

- Search
- Filter
- Sort
- Date range
- Category
- Merchant
- Transaction type
- Source
- Status

Each transaction should show:

```text
Merchant
Date/time
Category
Amount
Type
Source
```

Example:

```text
Amazon
Today · 14:32
Shopping
−₹1,499
SMS
```

---

# 20. Review Queue

Create a dedicated review workflow.

Examples:

```text
Unknown merchant
Uncategorized transaction
Low-confidence parsing
Possible duplicate
Possible transfer
Possible refund
```

The user should be able to quickly:

```text
Confirm
Edit
Categorize
Create rule
Ignore
```

The review interface should be especially good on mobile.

---

# 21. Analytics

Provide:

### Spending over time

- Daily
- Weekly
- Monthly

### Category analysis

- Category totals
- Category percentage
- Month-over-month change

### Merchant analysis

- Top merchants
- Merchant frequency
- Merchant spending trends

### Income

- Monthly income
- Income sources

### Transfers

- Transfer totals

### Recurring expenses

Identify likely recurring transactions.

---

# 22. Data Quality

Provide diagnostics for:

- Uncategorized transactions
- Unknown merchants
- Duplicate candidates
- Missing dates
- Missing amounts
- Invalid transaction types
- Low-confidence imports
- Failed Gmail parsing
- Failed SMS parsing
- Import errors

This should make debugging transparent.

---

# 23. Import History

Track imports.

Suggested fields:

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

Example:

```text
Gmail Import
4 Sep 2026
1,284 messages scanned
318 transactions detected
301 imported
17 duplicates
0 critical errors
```

---

# 24. API Concepts

Potential API structure:

```text
/transactions
/summary
/analytics
/categories
/review
/rules
/data-quality
/insights
/ai/query
```

Keep the API/data layer independent from UI components.

---

# 25. Mobile UX

Mobile is the priority.

Requirements:

- Thumb-friendly controls
- Large tap targets
- Bottom navigation where appropriate
- Compact cards
- Readable numbers
- Clear hierarchy
- Minimal forms
- Fast filtering
- Smooth scrolling
- Avoid dense desktop-style tables on mobile

---

# 26. Visual Direction

Apple-inspired, not a literal Apple clone.

Use:

- generous whitespace
- strong typography
- subtle borders
- restrained shadows
- rounded cards
- calm neutral surfaces
- clear hierarchy
- subtle motion
- polished loading states
- tasteful transitions

Avoid:

- excessive gradients
- excessive glass effects
- dashboard clutter
- huge decorative graphics
- unnecessary animations

Follow the Apple design principles/skills available in the project where appropriate.

---

# 27. Accessibility

Requirements:

- Keyboard accessibility
- Proper semantic HTML
- Accessible labels
- Sufficient contrast
- Focus states
- Reduced-motion support
- Screen-reader-friendly controls
- Large enough touch targets

---

# 28. Development Phases

## Phase 0 — Repository Audit

Before writing substantial code:

- Inspect repository
- Identify existing framework
- Identify existing components
- Identify existing data/API code
- Identify deployment configuration
- Identify current SMS integration
- Identify environment variables
- Identify tests/lint/typecheck setup

Do not unnecessarily rewrite an existing working system.

---

## Phase 1 — Frontend Foundation

Build:

- App shell
- Navigation
- Responsive layout
- Typography
- Design tokens
- Reusable UI primitives
- Dashboard skeleton
- Loading states
- Empty states
- Error states

Use mock data initially if backend data is unavailable.

---

## Phase 2 — Dashboard

Build:

- Spending total
- Monthly comparison
- Category summary
- AI insight placeholder
- Uncategorized amount
- Recent transactions

---

## Phase 3 — Transactions

Build:

- Transaction list
- Search
- Filters
- Sorting
- Detail view
- Category editing
- Merchant editing

---

## Phase 4 — Review

Build:

- Review queue
- Unknown merchant handling
- Category correction
- Duplicate review
- Rule creation
- Confirmation workflow

---

## Phase 5 — Google Sheets Integration

Connect to the existing Google Sheets data source.

Do not break the existing SMS pipeline.

Create a clean data-access layer.

---

## Phase 6 — Gmail Importer

Implement:

```text
SCAN
DRY RUN
IMPORT
```

Start with diagnostics and real email formats.

Do not guess sender domains or message structures.

---

## Phase 7 — Analytics

Implement:

- Trends
- Categories
- Merchants
- Income
- Transfers
- Recurring expenses
- Month-over-month comparisons

---

## Phase 8 — Finance AI

Implement:

```text
Metric engine
    ↓
Structured context
    ↓
Privacy filtering
    ↓
AI provider
    ↓
Insight/answer
```

Add provider abstraction.

---

## Phase 9 — Production Hardening

Check:

- Authentication/privacy
- Secrets
- Error handling
- Rate limits
- Input validation
- Logging
- Data integrity
- Duplicate handling
- Mobile UX
- Accessibility
- Performance
- Cloudflare deployment

---

# 29. Copilot Rules

GitHub Copilot should follow these rules.

### Rule 1

Read `PROJECT_SPEC.md` before implementing.

### Rule 2

Inspect the existing repository before changing architecture.

### Rule 3

Do not invent APIs, environment variables, database schemas, or credentials.

### Rule 4

Do not destroy or replace the existing SMS ingestion pipeline.

### Rule 5

Use deterministic financial calculations.

### Rule 6

AI should explain structured metrics rather than becoming the source of truth.

### Rule 7

Keep data access separate from UI.

### Rule 8

Keep AI provider integration abstract.

### Rule 9

Never commit secrets.

### Rule 10

Use mock data until real backend integration is ready.

### Rule 11

Run:

```text
lint
typecheck
tests
```

after meaningful implementation phases.

### Rule 12

Update the README when setup or architecture changes.

### Rule 13

Do not perform large unrelated refactors.

### Rule 14

Stop after the requested development phase.

---

# 30. Master Copilot Instruction

Use this instruction when starting implementation:

```text
Read PROJECT_SPEC.md completely before making changes.

First inspect the repository and understand the existing architecture, framework, components, integrations, deployment configuration, and especially the existing SMS-to-Google-Sheets transaction pipeline.

Do not replace or rewrite working systems without a clear reason.

Start with Phase 0 (Repository Audit) and Phase 1 (Frontend Foundation) only.

Build a polished, mobile-first, Apple-inspired personal finance portal using the project's existing stack where practical.

If backend data is not ready, use realistic mock transaction data behind a clean data-access abstraction.

Create reusable components and design tokens rather than one-off UI code.

Do not hard-code secrets.

Do not invent APIs or environment variables.

Keep financial calculations deterministic.

Keep future AI functionality behind an AI provider abstraction.

After implementation:
1. Run lint.
2. Run typecheck.
3. Run tests if available.
4. Fix issues you introduced.
5. Update README with relevant setup information.
6. Summarize the major changes.

Do not start Phase 2 or later until explicitly requested.
```

---

# 31. Recommended Git Workflow

Use small, understandable commits.

Example:

```text
feat: add finance portal app shell
feat: add dashboard foundation
feat: add transaction data model
feat: add transaction list
feat: add review workflow
feat: add sheets data adapter
feat: add gmail importer
feat: add analytics
feat: add finance ai
fix: ...
```

Avoid giant commits containing unrelated changes.

---

# 32. Review Workflow With ChatGPT

Development workflow:

```text
User
  ↓
GitHub Copilot
  ↓
Code implementation
  ↓
Local lint/typecheck/tests
  ↓
Git commit
  ↓
Push to GitHub
  ↓
ChatGPT repository review
  ↓
Issues / improvements
  ↓
Copilot fixes
  ↓
Push again
  ↓
ChatGPT re-review
```

ChatGPT should review:

### Architecture
- Is the structure maintainable?
- Are responsibilities separated?
- Is the data layer clean?

### Finance correctness
- Are expenses/income/refunds/transfers handled correctly?
- Are calculations deterministic?
- Are duplicates handled safely?

### Security
- Are secrets protected?
- Are server-side credentials isolated?
- Is sensitive financial data unnecessarily exposed?

### AI
- Is AI grounded in structured metrics?
- Can it hallucinate unsupported financial facts?
- Is unnecessary raw financial data sent to the model?
- Can the provider be swapped?

### UI
- Mobile usability
- Apple-inspired visual quality
- Accessibility
- Loading/error/empty states

### Deployment
- Cloudflare compatibility
- Environment configuration
- Production build
- Error handling

---

# 33. Important Product Philosophy

The goal is not to create another complicated finance spreadsheet.

The goal is:

```text
Transactions happen
        ↓
System logs them
        ↓
System categorizes them
        ↓
User reviews exceptions
        ↓
Dashboard explains spending
        ↓
AI helps interpret patterns
```

The system should require as little manual work as possible.

Automation should handle the repetitive work.

Rules should handle predictable classification.

AI should handle explanation and higher-level interpretation.

The user should remain in control of financial data and corrections.
