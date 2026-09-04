import type { TransactionProvider } from "@/lib/data/providers/types";
import { fetchSheetValues } from "@/lib/sheets/client";
import { mapRowsToTransactions } from "@/lib/sheets/mapRow";
import { rowToTransaction } from "@/lib/canonical/sheetSchema";
import type { Transaction } from "@/lib/types";

// No sheet/tab name confirmed yet — bare "A:D" targets the first tab (gid=0),
// which matches the 4-column, no-header dump the user described.
const DEFAULT_RANGE = "A:D";
const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";
const BANK_IMPORT_RANGE = process.env.GOOGLE_SHEETS_BANK_IMPORT_RANGE || "BankImports!A:U";

/** Reads one of our own app-owned tabs (header row + our schema). Missing/empty tab is not an error — it's optional. */
async function readOwnedTab(range: string): Promise<Transaction[]> {
  try {
    const rows = await fetchSheetValues(range);
    if (rows.length === 0) return [];
    const [header, ...dataRows] = rows;
    return dataRows.map((r) => rowToTransaction(header, r)).filter((t): t is Transaction => t !== null);
  } catch {
    return [];
  }
}

export class GoogleSheetsTransactionProvider implements TransactionProvider {
  async listTransactions() {
    const range = process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || DEFAULT_RANGE;
    const rows = await fetchSheetValues(range);
    const { transactions: smsTransactions, warnings } = mapRowsToTransactions(rows);
    for (const warning of warnings) console.warn(`[sheets] ${warning}`);

    // Merge the existing SMS tab with our own app-owned import tabs — this is
    // the canonical, source-agnostic dataset (project-spec-truth.md
    // "CANONICAL DATA FLOW"). Never writes to or alters the SMS tab.
    const [gmailTransactions, bankTransactions] = await Promise.all([
      readOwnedTab(GMAIL_IMPORT_RANGE),
      readOwnedTab(BANK_IMPORT_RANGE),
    ]);

    return [...smsTransactions, ...gmailTransactions, ...bankTransactions];
  }

  async listCategoryRules() {
    // Rules currently live only in the mock provider; a rules sheet/tab can
    // be added here once one exists in the real spreadsheet.
    return [];
  }

  async listImportHistory() {
    return [];
  }
}
