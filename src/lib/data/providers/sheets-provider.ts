import type { NewCategoryRuleInput, TransactionProvider } from "@/lib/data/providers/types";
import { appendSheetValues, fetchSheetValues } from "@/lib/sheets/client";
import { mapRowsToTransactions } from "@/lib/sheets/mapRow";
import { rowToTransaction } from "@/lib/canonical/sheetSchema";
import { categoryRuleToRow, rowToCategoryRule } from "@/lib/canonical/categoryRuleSchema";
import type { CategoryRule, Transaction } from "@/lib/types";

// No sheet/tab name confirmed yet — bare "A:D" targets the first tab (gid=0),
// which matches the 4-column, no-header dump the user described.
const DEFAULT_RANGE = "A:D";
const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";
const BANK_IMPORT_RANGE = process.env.GOOGLE_SHEETS_BANK_IMPORT_RANGE || "BankImports!A:U";
const CATEGORY_RULES_RANGE = process.env.GOOGLE_SHEETS_CATEGORY_RULES_RANGE || "CategoryRules!A:I";

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
    try {
      const rows = await fetchSheetValues(CATEGORY_RULES_RANGE);
      if (rows.length === 0) return [];
      const [header, ...dataRows] = rows;
      return dataRows.map((r) => rowToCategoryRule(header, r)).filter((r): r is CategoryRule => r !== null);
    } catch {
      return [];
    }
  }

  async createCategoryRule(input: NewCategoryRuleInput): Promise<CategoryRule> {
    const now = new Date().toISOString();
    const rule: CategoryRule = {
      ruleId: `r-${Date.now()}`,
      pattern: input.pattern,
      merchant: input.merchant,
      category: input.category,
      subcategory: input.subcategory,
      priority: input.priority,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    await appendSheetValues(CATEGORY_RULES_RANGE, [categoryRuleToRow(rule)]);
    return rule;
  }

  async listImportHistory() {
    return [];
  }
}
