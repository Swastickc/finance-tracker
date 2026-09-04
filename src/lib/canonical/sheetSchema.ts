import type { Category, Transaction, TransactionSource, TransactionStatus, TransactionType } from "@/lib/types";

/**
 * Header row for our own app-owned import tabs (e.g. "GmailImports",
 * "BankImports") — we control this schema fully; it does not touch or
 * resemble the existing SMS tab's layout.
 */
export const CANONICAL_HEADERS: (keyof Transaction)[] = [
  "id",
  "transactionDate",
  "transactionTime",
  "amount",
  "currency",
  "type",
  "merchant",
  "rawDescription",
  "category",
  "subcategory",
  "account",
  "paymentMethod",
  "source",
  "sourceMessageId",
  "status",
  "confidence",
  "isRecurring",
  "ruleId",
  "classificationNote",
  "createdAt",
  "updatedAt",
];

export function transactionToRow(t: Transaction): (string | number | boolean)[] {
  return CANONICAL_HEADERS.map((field) => {
    const value = t[field];
    return value === null || value === undefined ? "" : value;
  });
}

/** Reverse mapping — reads our own previously-written rows back into Transactions (for reconciliation). */
export function rowToTransaction(header: string[], row: string[]): Transaction | null {
  const index = new Map(header.map((h, i) => [h, i]));
  const cell = (field: keyof Transaction): string => {
    const i = index.get(field);
    return i === undefined ? "" : (row[i] ?? "");
  };

  const id = cell("id");
  const transactionDate = cell("transactionDate");
  const amount = Number(cell("amount"));
  if (!id || !transactionDate || !Number.isFinite(amount)) return null;

  return {
    id,
    transactionDate,
    transactionTime: cell("transactionTime") || null,
    amount,
    currency: cell("currency") || "INR",
    type: (cell("type") || "expense") as TransactionType,
    merchant: cell("merchant") || null,
    rawDescription: cell("rawDescription"),
    category: (cell("category") || "Uncategorized") as Category,
    subcategory: cell("subcategory") || null,
    account: cell("account") || null,
    paymentMethod: cell("paymentMethod") || null,
    source: (cell("source") || "import") as TransactionSource,
    sourceMessageId: cell("sourceMessageId") || null,
    status: (cell("status") || "review") as TransactionStatus,
    confidence: Number(cell("confidence")) || 0,
    isRecurring: cell("isRecurring").toLowerCase() === "true",
    ruleId: cell("ruleId") || null,
    classificationNote: cell("classificationNote") || null,
    createdAt: cell("createdAt") || new Date().toISOString(),
    updatedAt: cell("updatedAt") || new Date().toISOString(),
  };
}
