import { BANK_STATEMENT_COLUMNS, type BankParseResult, type ParsedBankRow } from "@/lib/bank/types";
import { parseIndianBankDate } from "@/lib/bank/parseDate";

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Pure row->ParsedBankRow mapping, header-based against the known column
 * names (BANK_STATEMENT_COLUMNS) — see bank/types.ts for provenance. No
 * network calls, no AI — safe to unit test with synthetic fixtures.
 */
export function parseStatementRows(rows: string[][]): BankParseResult {
  const warnings: string[] = [];
  if (rows.length === 0) return { rows: [], warnings };

  const header = rows[0].map((h) => h.trim());
  const headerIndex = new Map(header.map((h, i) => [h, i]));

  const missingColumns = BANK_STATEMENT_COLUMNS.filter((c) => !headerIndex.has(c));
  if (missingColumns.length > 0) {
    warnings.push(`Missing expected column(s): ${missingColumns.join(", ")}. Check the file matches the known statement format.`);
  }

  const cell = (row: string[], column: (typeof BANK_STATEMENT_COLUMNS)[number]): string => {
    const index = headerIndex.get(column);
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  const parsed: ParsedBankRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1; // 1-based, matches the sheet's row number

    // Skip fully blank rows (common trailing rows in bank exports).
    if (row.every((c) => !c || !c.trim())) continue;

    const rawTransactionDate = cell(row, "Transaction Date");
    const rawValueDate = cell(row, "Value Date");
    const rawWithdrawal = cell(row, "Withdrawal Amount(INR)");
    const rawDeposit = cell(row, "Deposit Amount(INR)");
    const rawBalance = cell(row, "Balance(INR)");
    const remarks = cell(row, "Transaction Remarks");
    const cheque = cell(row, "Cheque Number");

    const transactionDate = parseIndianBankDate(rawTransactionDate);
    if (!transactionDate) {
      warnings.push(`Row ${rowNumber}: unrecognized or missing Transaction Date — skipped.`);
      continue;
    }

    const withdrawal = parseAmount(rawWithdrawal);
    const deposit = parseAmount(rawDeposit);
    const hasWithdrawal = withdrawal !== null && withdrawal > 0;
    const hasDeposit = deposit !== null && deposit > 0;

    if (!hasWithdrawal && !hasDeposit) {
      warnings.push(`Row ${rowNumber}: neither withdrawal nor deposit amount present — skipped.`);
      continue;
    }
    if (hasWithdrawal && hasDeposit) {
      warnings.push(`Row ${rowNumber}: both withdrawal and deposit present — ambiguous, skipped.`);
      continue;
    }

    parsed.push({
      rowNumber,
      transactionDate,
      valueDate: parseIndianBankDate(rawValueDate),
      chequeNumber: cheque || null,
      transactionRemarks: remarks,
      amount: hasWithdrawal ? withdrawal! : deposit!,
      direction: hasWithdrawal ? "withdrawal" : "deposit",
      balance: parseAmount(rawBalance),
    });
  }

  return { rows: parsed, warnings };
}
