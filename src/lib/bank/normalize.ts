import type { ParsedBankRow } from "@/lib/bank/types";
import type { Transaction } from "@/lib/types";

function detectPaymentMethod(remarks: string): string | null {
  const upper = remarks.toUpperCase();
  if (upper.includes("UPI")) return "UPI";
  if (upper.includes("NEFT")) return "NEFT";
  if (upper.includes("IMPS")) return "IMPS";
  if (upper.includes("RTGS")) return "RTGS";
  if (upper.includes("CHQ") || upper.includes("CHEQUE")) return "Cheque";
  if (upper.includes("ATM")) return "ATM";
  return null;
}

/**
 * ParsedBankRow -> canonical Transaction. Deliberately conservative:
 * - merchant is left null (raw remarks are preserved verbatim; normalization
 *   happens later via the existing rule engine, never guessed here).
 * - every row is status:"review" — historical bank rows are never
 *   auto-confirmed (project-spec-truth.md: "send uncertain classifications
 *   to review").
 * - deposits default to type "income" only as a placeholder value (the
 *   Transaction schema requires a concrete type); confidence is kept low so
 *   Review clearly flags it as unverified, per "Never classify a transaction
 *   as income merely because money entered the account."
 */
export function normalizeBankRow(row: ParsedBankRow, sourceFile: string): Transaction {
  const id = `bank:${sourceFile}:${row.rowNumber}`;
  const now = new Date().toISOString();
  const isWithdrawal = row.direction === "withdrawal";
  const remarks = row.transactionRemarks;

  const isOwnAccountTransfer = /\bown\s*(a\/?c|account)\b|\bself\b|\bto\s+self\b/i.test(remarks);
  const isRefund = /\brefund(ed)?\b/i.test(remarks);

  let type: Transaction["type"] = isWithdrawal ? "expense" : "income";
  let confidence = isWithdrawal ? 0.6 : 0.35;
  let reason = isWithdrawal
    ? `bank-statement-parser: withdrawal column populated (${sourceFile}, row ${row.rowNumber}) — assumed expense, unverified`
    : `bank-statement-parser: deposit column populated (${sourceFile}, row ${row.rowNumber}) — type is a placeholder guess only; could be income, refund, or transfer`;

  if (isOwnAccountTransfer) {
    type = "transfer";
    confidence = 0.75;
    reason = `bank-statement-parser: remarks match an own-account/self-transfer pattern (${sourceFile}, row ${row.rowNumber}) — classified as transfer, excluded from income/spending`;
  } else if (isRefund && !isWithdrawal) {
    type = "refund";
    confidence = 0.65;
    reason = `bank-statement-parser: remarks match a refund pattern (${sourceFile}, row ${row.rowNumber})`;
  }

  return {
    id,
    transactionDate: row.transactionDate,
    transactionTime: null,
    amount: row.amount,
    currency: "INR",
    type,
    merchant: null,
    rawDescription: remarks || `${row.direction} of ${row.amount}`,
    category: "Uncategorized",
    subcategory: null,
    account: null,
    paymentMethod: row.chequeNumber ? "Cheque" : detectPaymentMethod(remarks),
    source: "import",
    sourceMessageId: id,
    status: "review",
    confidence,
    isRecurring: false,
    ruleId: null,
    classificationNote: reason,
    createdAt: now,
    updatedAt: now,
  };
}
