import { mockCategoryRules, mockImportHistory, mockTransactions } from "@/lib/mock-data";
import type { TransactionProvider } from "@/lib/data/providers/types";

export class MockTransactionProvider implements TransactionProvider {
  async listTransactions() {
    return mockTransactions;
  }

  async listCategoryRules() {
    return mockCategoryRules;
  }

  async listImportHistory() {
    return mockImportHistory;
  }
}
