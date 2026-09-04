import { monthLabel } from "@/lib/date";
import { getCategoryAnalysis, getMerchantAnalysis, getRecurringExpenses } from "@/lib/data/analytics";
import { getMonthlySummary } from "@/lib/data/transactions";

export interface FinancialContext {
  monthLabel: string;
  currency: string;
  totalSpend: number;
  previousMonthSpend: number;
  changePercent: number | null;
  incomeTotal: number;
  transferTotal: number;
  uncategorizedSpend: number;
  topCategories: { category: string; amount: number; changePercent: number | null }[];
  topMerchants: { merchant: string; amount: number }[];
  recurringExpenses: { merchant: string; averageAmount: number }[];
}

/**
 * Assembles the ONLY data the AI is allowed to see (PROJECT_SPEC.md §15, §16).
 * Privacy is by construction, not by filtering afterwards: this never touches
 * raw transaction rows, so it structurally cannot leak rawDescription,
 * account numbers, payment methods, or message IDs to a provider — only
 * aggregate amounts and category/merchant names.
 */
export async function buildFinancialContext(): Promise<FinancialContext> {
  const [summary, categories, merchants, recurring] = await Promise.all([
    getMonthlySummary(),
    getCategoryAnalysis(),
    getMerchantAnalysis(),
    getRecurringExpenses(),
  ]);

  return {
    monthLabel: monthLabel(summary.monthKey),
    currency: "INR",
    totalSpend: summary.totalSpend,
    previousMonthSpend: summary.previousMonthSpend,
    changePercent: summary.changePercent,
    incomeTotal: summary.incomeTotal,
    transferTotal: summary.transferTotal,
    uncategorizedSpend: summary.uncategorizedSpend,
    topCategories: categories.slice(0, 5).map((c) => ({
      category: c.category,
      amount: c.amount,
      changePercent: c.changePercent,
    })),
    topMerchants: merchants.slice(0, 5).map((m) => ({ merchant: m.merchant, amount: m.totalSpend })),
    recurringExpenses: recurring.slice(0, 5).map((r) => ({ merchant: r.merchant, averageAmount: r.averageAmount })),
  };
}
