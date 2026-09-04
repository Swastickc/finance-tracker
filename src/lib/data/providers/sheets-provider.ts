import type { TransactionProvider } from "@/lib/data/providers/types";
import { fetchSheetValues } from "@/lib/sheets/client";
import { mapRowsToTransactions } from "@/lib/sheets/mapRow";

// No sheet/tab name confirmed yet — bare "A:D" targets the first tab (gid=0),
// which matches the 4-column, no-header dump the user described.
const DEFAULT_RANGE = "A:D";

export class GoogleSheetsTransactionProvider implements TransactionProvider {
  async listTransactions() {
    const range = process.env.GOOGLE_SHEETS_TRANSACTIONS_RANGE || DEFAULT_RANGE;
    const rows = await fetchSheetValues(range);
    const { transactions, warnings } = mapRowsToTransactions(rows);
    for (const warning of warnings) console.warn(`[sheets] ${warning}`);
    return transactions;
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
