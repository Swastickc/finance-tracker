import type { CategoryRule, ImportRecord, Transaction } from "@/lib/types";

/** Implemented by each data source (mock, Google Sheets, future sources). */
export interface TransactionProvider {
  listTransactions(): Promise<Transaction[]>;
  listCategoryRules(): Promise<CategoryRule[]>;
  listImportHistory(): Promise<ImportRecord[]>;
}
