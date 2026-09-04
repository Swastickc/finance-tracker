import type { TransactionProvider } from "@/lib/data/providers/types";
import { fetchSheetValues } from "@/lib/sheets/client";
import { mapRowsToTransactions } from "@/lib/sheets/mapRow";

const DEFAULT_RANGE = "Transactions!A:T";

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
