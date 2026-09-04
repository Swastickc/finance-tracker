import { getTransactionProvider } from "@/lib/data/provider";
import type { Category, CategoryRule, ImportRecord, Transaction } from "@/lib/types";

// Data-access layer: delegates to whichever TransactionProvider is active
// (mock by default, Google Sheets when DATA_SOURCE=sheets — see
// src/lib/data/provider.ts). UI code should only ever import from here.

function monthKey(isoDate: string) {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

function previousMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getTransactions(): Promise<Transaction[]> {
  const all = await getTransactionProvider().listTransactions();
  return [...all].sort((a, b) =>
    `${b.transactionDate}T${b.transactionTime ?? "00:00"}`.localeCompare(
      `${a.transactionDate}T${a.transactionTime ?? "00:00"}`
    )
  );
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  return getTransactionProvider().listCategoryRules();
}

export async function getImportHistory(): Promise<ImportRecord[]> {
  return getTransactionProvider().listImportHistory();
}

export interface CategoryTotal {
  category: Category;
  amount: number;
}

export interface MonthlySummary {
  monthKey: string;
  totalSpend: number;
  previousMonthSpend: number;
  changePercent: number | null;
  categoryTotals: CategoryTotal[];
  uncategorizedSpend: number;
  reviewCount: number;
  incomeTotal: number;
  transferTotal: number;
  recentTransactions: Transaction[];
}

/** Deterministic aggregation — no AI involved. See PROJECT_SPEC.md §13. */
export async function getMonthlySummary(referenceMonthKey?: string): Promise<MonthlySummary> {
  const all = await getTransactions();
  const currentKey = referenceMonthKey ?? monthKey(all[0]?.transactionDate ?? new Date().toISOString());
  const previousKey = previousMonthKey(currentKey);

  const spend = (txns: Transaction[]) => {
    const expense = txns.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
    const refunded = txns.filter((t) => t.type === "refund").reduce((sum, t) => sum + t.amount, 0);
    return expense - refunded;
  };

  const currentMonthTxns = all.filter((t) => monthKey(t.transactionDate) === currentKey);
  const previousMonthTxns = all.filter((t) => monthKey(t.transactionDate) === previousKey);

  const totalSpend = spend(currentMonthTxns);
  const previousMonthSpend = spend(previousMonthTxns);
  const changePercent = previousMonthSpend > 0 ? ((totalSpend - previousMonthSpend) / previousMonthSpend) * 100 : null;

  const categoryMap = new Map<Category, number>();
  for (const t of currentMonthTxns) {
    if (t.type !== "expense") continue;
    categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + t.amount);
  }
  const categoryTotals = [...categoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const uncategorizedSpend = categoryMap.get("Uncategorized") ?? 0;
  const reviewCount = currentMonthTxns.filter((t) => t.status === "review").length;
  const incomeTotal = currentMonthTxns.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const transferTotal = currentMonthTxns.filter((t) => t.type === "transfer").reduce((sum, t) => sum + t.amount, 0);

  return {
    monthKey: currentKey,
    totalSpend,
    previousMonthSpend,
    changePercent,
    categoryTotals,
    uncategorizedSpend,
    reviewCount,
    incomeTotal,
    transferTotal,
    recentTransactions: currentMonthTxns.slice(0, 5),
  };
}
