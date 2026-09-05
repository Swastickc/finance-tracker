import type { CategoryRule, ImportRecord, Transaction } from "@/lib/types";

export type NewCategoryRuleInput = Pick<CategoryRule, "pattern" | "merchant" | "category" | "subcategory" | "priority">;

/** Implemented by each data source (mock, Google Sheets, future sources). */
export interface TransactionProvider {
  listTransactions(): Promise<Transaction[]>;
  listCategoryRules(): Promise<CategoryRule[]>;
  createCategoryRule(input: NewCategoryRuleInput): Promise<CategoryRule>;
  listImportHistory(): Promise<ImportRecord[]>;
}
