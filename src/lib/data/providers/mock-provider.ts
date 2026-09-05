import { mockCategoryRules, mockImportHistory, mockTransactions } from "@/lib/mock-data";
import type { NewCategoryRuleInput, TransactionProvider } from "@/lib/data/providers/types";
import type { CategoryRule } from "@/lib/types";

export class MockTransactionProvider implements TransactionProvider {
  private rules: CategoryRule[] = [...mockCategoryRules];

  async listTransactions() {
    return mockTransactions;
  }

  async listCategoryRules() {
    return this.rules;
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
    this.rules = [rule, ...this.rules];
    return rule;
  }

  async listImportHistory() {
    return mockImportHistory;
  }
}
