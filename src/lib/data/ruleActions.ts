"use server";

import { getTransactionProvider } from "@/lib/data/provider";
import { invalidateCategoryRulesCache } from "@/lib/data/transactions";
import type { Category, CategoryRule } from "@/lib/types";

export interface NewRuleInput {
  pattern: string;
  merchant: string;
  category: Category;
}

/** Persists a rule created from the Review page so it actually applies to future (and past-but-uncategorized) transactions. */
export async function createCategoryRuleAction(input: NewRuleInput): Promise<CategoryRule> {
  const pattern = input.pattern.trim().slice(0, 100);
  const merchant = input.merchant.trim().slice(0, 80);
  if (!pattern || !merchant) throw new Error("Pattern and merchant are required.");

  const rule = await getTransactionProvider().createCategoryRule({
    pattern,
    merchant,
    category: input.category,
    subcategory: null,
    priority: 5,
  });
  invalidateCategoryRulesCache();
  return rule;
}
