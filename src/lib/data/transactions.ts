import { getTransactionProvider } from "@/lib/data/provider";
import { monthKey, shiftMonthKey } from "@/lib/date";
import type { Category, CategoryRule, ImportRecord, Transaction } from "@/lib/types";

// Data-access layer: delegates to whichever TransactionProvider is active
// (mock by default, Google Sheets when DATA_SOURCE=sheets — see
// src/lib/data/provider.ts). UI code should only ever import from here.

// Short-lived in-flight/result cache: several call sites (e.g.
// src/lib/data/analytics.ts calls this 6 times in one page render) used to
// each trigger their own independent 3-sheet fetch+parse, which blew past
// the Worker's CPU/resource limits once the dataset grew past ~1000 rows.
// Caching the in-flight promise dedupes concurrent calls within a single
// request; the short TTL also avoids re-fetching on rapid navigation.
let cached: { promise: Promise<Transaction[]>; at: number } | null = null;
const CACHE_TTL_MS = 10_000;

export async function getTransactions(): Promise<Transaction[]> {
  const now = Date.now();
  if (!cached || now - cached.at > CACHE_TTL_MS) {
    const promise = getTransactionProvider()
      .listTransactions()
      .catch((err) => {
        cached = null; // never cache a failure
        throw err;
      });
    cached = { promise, at: now };
  }
  const all = await cached.promise;
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
  const previousKey = shiftMonthKey(currentKey, -1);

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
