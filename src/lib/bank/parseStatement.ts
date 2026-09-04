import { BANK_STATEMENT_COLUMNS, type BankParseResult, type ParsedBankRow } from "@/lib/bank/types";
import { parseIndianBankDate } from "@/lib/bank/parseDate";

/** Real exports commonly have several preamble rows (account holder, period, address) before the header. */
const HEADER_SCAN_LIMIT = 30;

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Scans the first HEADER_SCAN_LIMIT rows for the one that contains every
 * known column label (case-insensitive, exact cell match) — the header row
 * position is NOT assumed to be row 0. Returns -1 if no row matches all
 * required labels within the scan window.
 */
function findHeaderRowIndex(rows: string[][]): number {
  const limit = Math.min(HEADER_SCAN_LIMIT, rows.length);
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map((c) => c.trim().toLowerCase());
    const score = BANK_STATEMENT_COLUMNS.filter((col) => cells.includes(col.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore === BANK_STATEMENT_COLUMNS.length ? bestIndex : -1;
}

/**
 * Pure row->ParsedBankRow mapping, header-based against the known column
 * names (BANK_STATEMENT_COLUMNS) — see bank/types.ts for provenance. No
 * network calls, no AI — safe to unit test with synthetic fixtures.
 */
export function parseStatementRows(rows: string[][]): BankParseResult {
  const warnings: string[] = [];
  if (rows.length === 0) return { rows: [], warnings };

  const headerRowIndex = findHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    warnings.push(
      `Could not find a header row matching all expected columns (${BANK_STATEMENT_COLUMNS.join(", ")}) in the first ${Math.min(HEADER_SCAN_LIMIT, rows.length)} rows.`
    );
    return { rows: [], warnings };
  }
  if (headerRowIndex > 0) {
    warnings.push(`Header row detected at row ${headerRowIndex + 1} (skipped ${headerRowIndex} preamble row(s)).`);
  }

  const header = rows[headerRowIndex].map((h) => h.trim());
  const headerIndex = new Map(header.map((h, i) => [h, i]));

  const cell = (row: string[], column: (typeof BANK_STATEMENT_COLUMNS)[number]): string => {
    const index = headerIndex.get(column);
    return index === undefined ? "" : (row[index] ?? "").trim();
  };

  const parsed: ParsedBankRow[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
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
