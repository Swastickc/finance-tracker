/**
 * Known bank-statement export schema (project-spec-truth.md §"BANK STATEMENT
 * IMPORT" / context-source-of-truth.md). This is the literal column layout
 * the user described for OpTransactionHistory04-09-2026.xls and
 * Newopstrans.xls — NOT guessed. The actual files were not available in this
 * environment, so parsing has been validated only against synthetic fixtures
 * built from this exact schema (see parseStatement.test.ts). Real files must
 * be run through DRY RUN before any IMPORT is trusted.
 */
export const BANK_STATEMENT_COLUMNS = [
  "S No.",
  "Value Date",
  "Transaction Date",
  "Cheque Number",
  "Transaction Remarks",
  "Withdrawal Amount(INR)",
  "Deposit Amount(INR)",
  "Balance(INR)",
] as const;

export type BankDirection = "withdrawal" | "deposit";

export interface ParsedBankRow {
  rowNumber: number; // 1-based, matches the sheet's row number (including header)
  transactionDate: string; // ISO "YYYY-MM-DD"
  valueDate: string | null; // ISO "YYYY-MM-DD"
  chequeNumber: string | null;
  transactionRemarks: string;
  amount: number;
  direction: BankDirection;
  balance: number | null;
}

export interface BankParseResult {
  rows: ParsedBankRow[];
  /** Row-number-only warnings — never includes remarks/amount content (privacy). */
  warnings: string[];
}
