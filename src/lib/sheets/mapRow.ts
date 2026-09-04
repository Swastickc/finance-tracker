import {
  CATEGORIES,
  TRANSACTION_SOURCES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  type Category,
  type Transaction,
  type TransactionSource,
  type TransactionStatus,
  type TransactionType,
} from "@/lib/types";

/**
 * Expected header row for the transactions sheet, matching the unified
 * schema field names from PROJECT_SPEC.md §5 exactly.
 *
 * IMPORTANT: this must be confirmed against the real, existing SMS -> Sheets
 * spreadsheet before enabling DATA_SOURCE=sheets. If the actual sheet uses
 * different header names, update the values on the right-hand side below —
 * everything else in this file works off this map.
 */
export const TRANSACTION_COLUMNS = {
  id: "id",
  transactionDate: "transaction_date",
  transactionTime: "transaction_time",
  amount: "amount",
  currency: "currency",
  type: "type",
  merchant: "merchant",
  rawDescription: "raw_description",
  category: "category",
  subcategory: "subcategory",
  account: "account",
  paymentMethod: "payment_method",
  source: "source",
  sourceMessageId: "source_message_id",
  status: "status",
  confidence: "confidence",
  isRecurring: "is_recurring",
  ruleId: "rule_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const satisfies Record<keyof Transaction, string>;

export interface MapRowsResult {
  transactions: Transaction[];
  /** Row-index-only warnings — never includes amounts/merchant content (privacy). */
  warnings: string[];
}

function cell(row: string[], headerIndex: Map<string, number>, field: keyof Transaction): string {
  const index = headerIndex.get(TRANSACTION_COLUMNS[field]);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

/** Pure row->Transaction mapping. No network calls, no AI — safe to unit test. */
export function mapRowsToTransactions(rows: string[][]): MapRowsResult {
  const warnings: string[] = [];
  if (rows.length === 0) return { transactions: [], warnings };

  const header = rows[0].map((h) => h.trim());
  const headerIndex = new Map(header.map((h, i) => [h, i]));

  const transactions: Transaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1; // 1-based, matches the sheet's row number

    const id = cell(row, headerIndex, "id");
    const transactionDate = cell(row, headerIndex, "transactionDate");
    const rawAmount = cell(row, headerIndex, "amount");
    const rawType = cell(row, headerIndex, "type") as TransactionType;
    const rawDescription = cell(row, headerIndex, "rawDescription");

    if (!id || !transactionDate || !rawAmount || !rawDescription) {
      warnings.push(`Row ${rowNumber}: missing a required field (id, transaction_date, amount, or raw_description) — skipped.`);
      continue;
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) {
      warnings.push(`Row ${rowNumber}: amount is not a number — skipped.`);
      continue;
    }

    if (!TRANSACTION_TYPES.includes(rawType)) {
      warnings.push(`Row ${rowNumber}: invalid transaction type "${rawType}" — skipped.`);
      continue;
    }

    const rawCategory = cell(row, headerIndex, "category") as Category;
    const category = CATEGORIES.includes(rawCategory) ? rawCategory : "Uncategorized";
    if (!CATEGORIES.includes(rawCategory)) {
      warnings.push(`Row ${rowNumber}: unrecognized category — defaulted to Uncategorized.`);
    }

    const rawSource = cell(row, headerIndex, "source") as TransactionSource;
    const source = TRANSACTION_SOURCES.includes(rawSource) ? rawSource : "import";

    const rawStatus = cell(row, headerIndex, "status") as TransactionStatus;
    const status = TRANSACTION_STATUSES.includes(rawStatus) ? rawStatus : "review";

    const confidenceRaw = cell(row, headerIndex, "confidence");
    const confidence = confidenceRaw ? Number(confidenceRaw) : 1;

    transactions.push({
      id,
      transactionDate,
      transactionTime: cell(row, headerIndex, "transactionTime") || null,
      amount,
      currency: cell(row, headerIndex, "currency") || "INR",
      type: rawType,
      merchant: cell(row, headerIndex, "merchant") || null,
      rawDescription,
      category,
      subcategory: cell(row, headerIndex, "subcategory") || null,
      account: cell(row, headerIndex, "account") || null,
      paymentMethod: cell(row, headerIndex, "paymentMethod") || null,
      source,
      sourceMessageId: cell(row, headerIndex, "sourceMessageId") || null,
      status,
      confidence: Number.isFinite(confidence) ? confidence : 1,
      isRecurring: cell(row, headerIndex, "isRecurring").toLowerCase() === "true",
      ruleId: cell(row, headerIndex, "ruleId") || null,
      createdAt: cell(row, headerIndex, "createdAt") || new Date().toISOString(),
      updatedAt: cell(row, headerIndex, "updatedAt") || new Date().toISOString(),
    });
  }

  return { transactions, warnings };
}
