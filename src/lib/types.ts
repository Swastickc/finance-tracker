// Unified, source-agnostic transaction schema (see PROJECT_SPEC.md §5).

export type TransactionType = "expense" | "income" | "refund" | "transfer";
export const TRANSACTION_TYPES: TransactionType[] = ["expense", "income", "refund", "transfer"];

export type TransactionSource = "sms" | "gmail" | "manual" | "import";
export const TRANSACTION_SOURCES: TransactionSource[] = ["sms", "gmail", "manual", "import"];

export type TransactionStatus = "confirmed" | "review" | "ignored";
export const TRANSACTION_STATUSES: TransactionStatus[] = ["confirmed", "review", "ignored"];

export type Category =
  | "Food"
  | "Transport"
  | "Shopping"
  | "Bills"
  | "Entertainment"
  | "Health"
  | "Travel"
  | "Subscriptions"
  | "Salary"
  | "Other"
  | "Uncategorized";

export const CATEGORIES: Category[] = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Travel",
  "Subscriptions",
  "Salary",
  "Other",
  "Uncategorized",
];

export interface Transaction {
  id: string;
  transactionDate: string; // ISO date, e.g. "2026-09-04"
  transactionTime: string | null; // "HH:mm", 24h, null if unknown
  amount: number; // always positive; sign is implied by `type`
  currency: string; // ISO 4217, e.g. "INR"
  type: TransactionType;
  merchant: string | null; // normalized merchant name
  rawDescription: string; // original, unmodified source text — never overwritten
  category: Category;
  subcategory: string | null;
  account: string | null;
  paymentMethod: string | null;
  source: TransactionSource;
  sourceMessageId: string | null;
  status: TransactionStatus;
  confidence: number; // 0..1
  isRecurring: boolean;
  ruleId: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

export interface CategoryRule {
  ruleId: string;
  pattern: string;
  merchant: string;
  category: Category;
  subcategory: string | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ImportStatus = "running" | "completed" | "failed";

export interface ImportRecord {
  importId: string;
  source: TransactionSource;
  startedAt: string;
  completedAt: string | null;
  messagesScanned: number;
  transactionsDetected: number;
  transactionsImported: number;
  duplicates: number;
  errors: number;
  status: ImportStatus;
}

export interface DataQualityIssue {
  id: string;
  type:
    | "uncategorized"
    | "unknown_merchant"
    | "possible_duplicate"
    | "missing_date"
    | "missing_amount"
    | "invalid_type"
    | "low_confidence"
    | "parse_failure";
  transactionId: string | null;
  message: string;
  detectedAt: string;
}
