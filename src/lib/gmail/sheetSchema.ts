import type { Transaction } from "@/lib/types";

/**
 * Header row for the dedicated "GmailImports" tab (ours — we control this
 * schema; it does not touch or resemble the existing SMS tab's layout).
 */
export const GMAIL_IMPORT_HEADERS: (keyof Transaction)[] = [
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
  "createdAt",
  "updatedAt",
];

export function transactionToRow(t: Transaction): (string | number | boolean)[] {
  return GMAIL_IMPORT_HEADERS.map((field) => {
    const value = t[field];
    return value === null ? "" : value;
  });
}
