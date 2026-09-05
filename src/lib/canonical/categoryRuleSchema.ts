import type { Category, CategoryRule } from "@/lib/types";

/** Header row for the app-owned "CategoryRules" tab (see PROJECT_SPEC.md §12). */
export const CATEGORY_RULE_HEADERS: (keyof CategoryRule)[] = [
  "ruleId",
  "pattern",
  "merchant",
  "category",
  "subcategory",
  "priority",
  "enabled",
  "createdAt",
  "updatedAt",
];

export function categoryRuleToRow(r: CategoryRule): (string | number | boolean)[] {
  return CATEGORY_RULE_HEADERS.map((field) => {
    const value = r[field];
    return value === null || value === undefined ? "" : value;
  });
}

export function rowToCategoryRule(header: string[], row: string[]): CategoryRule | null {
  const index = new Map(header.map((h, i) => [h, i]));
  const cell = (field: keyof CategoryRule): string => {
    const i = index.get(field);
    return i === undefined ? "" : (row[i] ?? "");
  };

  const ruleId = cell("ruleId");
  const pattern = cell("pattern");
  const category = cell("category");
  if (!ruleId || !pattern || !category) return null;

  return {
    ruleId,
    pattern,
    merchant: cell("merchant"),
    category: category as Category,
    subcategory: cell("subcategory") || null,
    priority: Number(cell("priority")) || 0,
    enabled: cell("enabled").toLowerCase() !== "false",
    createdAt: cell("createdAt") || new Date().toISOString(),
    updatedAt: cell("updatedAt") || new Date().toISOString(),
  };
}
