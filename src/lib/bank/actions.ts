"use server";

import { readWorkbookRows } from "@/lib/bank/readWorkbook";
import { parseStatementRows } from "@/lib/bank/parseStatement";
import { normalizeBankRow } from "@/lib/bank/normalize";
import { reconcileBankTransactions } from "@/lib/bank/reconcile";
import { fetchSheetValues, appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow, rowToTransaction } from "@/lib/canonical/sheetSchema";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRateLimitKey } from "@/lib/requestIdentity";
import { addMockImportRecord } from "@/lib/mock-data";
import type { Transaction } from "@/lib/types";

const BANK_IMPORT_RANGE = process.env.GOOGLE_SHEETS_BANK_IMPORT_RANGE || "BankImports!A:U";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_ROWS = 5000;

export interface BankDryRunResult {
  fileName: string;
  parsedCount: number;
  transactions: Transaction[];
  parseWarnings: string[];
  exactDuplicateCount: number;
  possibleDuplicates: { a: string; b: string }[];
}

/** Reads previously-imported bank rows (if any) for cross-file reconciliation. Never touches the existing SMS tab. */
async function readExistingBankTransactions(): Promise<Transaction[]> {
  if (process.env.DATA_SOURCE !== "sheets") return [];
  try {
    const sheetRows = await fetchSheetValues(BANK_IMPORT_RANGE);
    if (sheetRows.length === 0) return [];
    const [header, ...dataRows] = sheetRows;
    return dataRows.map((r) => rowToTransaction(header, r)).filter((t): t is Transaction => t !== null);
  } catch {
    return []; // non-fatal for dry run — reconciliation just runs without prior context
  }
}

/** Parses an uploaded statement and reconciles it — writes nothing. */
export async function dryRunBankStatementAction(formData: FormData): Promise<BankDryRunResult> {
  const key = `bank:dry-run:${await getRateLimitKey()}`;
  if (!checkRateLimit(key, 10, 60_000)) {
    throw new Error("Too many bank statement actions in a short time — please wait a moment.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided.");
  if (file.size > MAX_FILE_SIZE) throw new Error("File is too large (max 5MB).");

  const buffer = await file.arrayBuffer();
  const rows = readWorkbookRows(buffer).slice(0, MAX_ROWS + 1);
  const { rows: parsedRows, warnings } = parseStatementRows(rows);
  const candidates = parsedRows.map((r) => normalizeBankRow(r, file.name));
  const candidateIds = new Set(candidates.map((c) => c.id));

  const existing = await readExistingBankTransactions();
  const reconciled = reconcileBankTransactions([...existing, ...candidates]);

  return {
    fileName: file.name,
    parsedCount: candidates.length,
    transactions: reconciled.transactions.filter((t) => candidateIds.has(t.id)),
    parseWarnings: warnings,
    exactDuplicateCount: reconciled.exactDuplicateCount,
    possibleDuplicates: reconciled.possibleDuplicates.filter((d) => candidateIds.has(d.a) || candidateIds.has(d.b)),
  };
}

/** Writes only the rows the user approved (i.e. not left as status:"ignored" by reconciliation, unless explicitly kept). */
export async function importBankStatementAction(
  transactions: Transaction[]
): Promise<{ imported: number; ignored: number }> {
  const key = `bank:import:${await getRateLimitKey()}`;
  if (!checkRateLimit(key, 5, 60_000)) {
    throw new Error("Too many bank statement actions in a short time — please wait a moment.");
  }
  if (!Array.isArray(transactions) || transactions.length === 0) return { imported: 0, ignored: 0 };

  const capped = transactions.slice(0, MAX_ROWS);
  const importable = capped.filter((t) => t.status !== "ignored");
  const ignoredCount = capped.length - importable.length;

  if (process.env.DATA_SOURCE === "sheets") {
    if (capped.length > 0) await appendSheetValues(BANK_IMPORT_RANGE, capped.map(transactionToRow));
  } else {
    const now = new Date().toISOString();
    addMockImportRecord({
      importId: `imp-bank-${Date.now()}`,
      source: "import",
      startedAt: now,
      completedAt: now,
      messagesScanned: capped.length,
      transactionsDetected: capped.length,
      transactionsImported: importable.length,
      duplicates: 0,
      possibleDuplicates: 0,
      ignoredRecords: ignoredCount,
      errors: 0,
      status: "completed",
    });
  }

  return { imported: importable.length, ignored: ignoredCount };
}
