import type { CategoryRule, Transaction } from "@/lib/types";

/**
 * Deterministic merchant/category rule engine (PROJECT_SPEC.md §12). Runs
 * entirely locally, no AI involved (§13) — this is the "deterministic
 * calculations first" layer the AI is only ever allowed to explain, never
 * replace.
 *
 * Only ever fills in a category that is currently "Uncategorized" — never
 * overrides a category a user, or a more specific classifier, already set.
 * `pattern` is matched as a case-insensitive regex (mock rules already use
 * alternation like "AMAZON.IN|AMZN"); invalid patterns are skipped rather
 * than throwing, since rules can be freely created via the Review UI.
 */
export function applyCategoryRules(transactions: Transaction[], rules: CategoryRule[]): Transaction[] {
  const compiled = rules
    .filter((r) => r.enabled)
    .sort((a, b) => b.priority - a.priority)
    .map((rule) => {
      try {
        return { rule, regex: new RegExp(rule.pattern, "i") };
      } catch {
        return { rule, regex: null };
      }
    })
    .filter((c): c is { rule: CategoryRule; regex: RegExp } => c.regex !== null);

  if (compiled.length === 0) return transactions;

  return transactions.map((t) => {
    if (t.category !== "Uncategorized") return t;

    const haystack = `${t.merchant ?? ""} ${t.rawDescription}`;
    const match = compiled.find((c) => c.regex.test(haystack));
    if (!match) return t;

    return {
      ...t,
      category: match.rule.category,
      subcategory: match.rule.subcategory ?? t.subcategory,
      merchant: t.merchant ?? (match.rule.merchant || null),
      ruleId: match.rule.ruleId,
    };
  });
}
