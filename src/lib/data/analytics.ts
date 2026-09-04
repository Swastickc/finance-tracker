import { getTransactions } from "@/lib/data/transactions";
import { monthKey, monthLabel, shiftMonthKey } from "@/lib/date";
import type { Category, Transaction } from "@/lib/types";

function spend(txns: Transaction[]) {
  const expense = txns.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const refunded = txns.filter((t) => t.type === "refund").reduce((sum, t) => sum + t.amount, 0);
  return expense - refunded;
}

async function latestMonthKey(all: Transaction[]) {
  return monthKey(all[0]?.transactionDate ?? new Date().toISOString());
}

export interface TrendPoint {
  monthKey: string;
  label: string;
  amount: number;
}

/** Deterministic — no AI involved. See PROJECT_SPEC.md §13, §21. */
export async function getSpendingTrend(months = 6): Promise<TrendPoint[]> {
  const all = await getTransactions();
  const latestKey = await latestMonthKey(all);
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(latestKey, -i);
    const txns = all.filter((t) => monthKey(t.transactionDate) === key);
    points.push({ monthKey: key, label: monthLabel(key), amount: spend(txns) });
  }
  return points;
}

export interface CategoryTrend {
  category: Category;
  amount: number;
  previousAmount: number;
  changePercent: number | null;
  percentOfSpend: number;
}

export async function getCategoryAnalysis(referenceMonthKey?: string): Promise<CategoryTrend[]> {
  const all = await getTransactions();
  const currentKey = referenceMonthKey ?? (await latestMonthKey(all));
  const previousKey = shiftMonthKey(currentKey, -1);

  const totalsFor = (key: string) => {
    const map = new Map<Category, number>();
    for (const t of all) {
      if (t.type !== "expense" || monthKey(t.transactionDate) !== key) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return map;
  };

  const current = totalsFor(currentKey);
  const previous = totalsFor(previousKey);
  const totalSpend = [...current.values()].reduce((sum, a) => sum + a, 0);

  return [...new Set([...current.keys(), ...previous.keys()])]
    .map((category) => {
      const amount = current.get(category) ?? 0;
      const previousAmount = previous.get(category) ?? 0;
      const changePercent = previousAmount > 0 ? ((amount - previousAmount) / previousAmount) * 100 : null;
      return {
        category,
        amount,
        previousAmount,
        changePercent,
        percentOfSpend: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export interface MerchantStat {
  merchant: string;
  totalSpend: number;
  transactionCount: number;
  previousMonthSpend: number;
  changePercent: number | null;
}

export async function getMerchantAnalysis(referenceMonthKey?: string): Promise<MerchantStat[]> {
  const all = await getTransactions();
  const currentKey = referenceMonthKey ?? (await latestMonthKey(all));
  const previousKey = shiftMonthKey(currentKey, -1);

  const current = all.filter((t) => t.type === "expense" && t.merchant && monthKey(t.transactionDate) === currentKey);
  const previous = all.filter((t) => t.type === "expense" && t.merchant && monthKey(t.transactionDate) === previousKey);

  const byMerchant = new Map<string, { total: number; count: number }>();
  for (const t of current) {
    const entry = byMerchant.get(t.merchant!) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    byMerchant.set(t.merchant!, entry);
  }

  const previousByMerchant = new Map<string, number>();
  for (const t of previous) {
    previousByMerchant.set(t.merchant!, (previousByMerchant.get(t.merchant!) ?? 0) + t.amount);
  }

  return [...byMerchant.entries()]
    .map(([merchant, { total, count }]) => {
      const previousMonthSpend = previousByMerchant.get(merchant) ?? 0;
      const changePercent = previousMonthSpend > 0 ? ((total - previousMonthSpend) / previousMonthSpend) * 100 : null;
      return { merchant, totalSpend: total, transactionCount: count, previousMonthSpend, changePercent };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

export interface IncomeSource {
  source: string;
  total: number;
}

export interface IncomeAnalysis {
  monthly: TrendPoint[];
  sources: IncomeSource[];
}

export async function getIncomeAnalysis(months = 6): Promise<IncomeAnalysis> {
  const all = await getTransactions();
  const latestKey = await latestMonthKey(all);

  const monthly: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(latestKey, -i);
    const total = all
      .filter((t) => t.type === "income" && monthKey(t.transactionDate) === key)
      .reduce((sum, t) => sum + t.amount, 0);
    monthly.push({ monthKey: key, label: monthLabel(key), amount: total });
  }

  const sourceMap = new Map<string, number>();
  for (const t of all) {
    if (t.type !== "income" || monthKey(t.transactionDate) !== latestKey) continue;
    const source = t.merchant ?? "Other income";
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + t.amount);
  }
  const sources = [...sourceMap.entries()]
    .map(([source, total]) => ({ source, total }))
    .sort((a, b) => b.total - a.total);

  return { monthly, sources };
}

export async function getTransferAnalysis(months = 6): Promise<TrendPoint[]> {
  const all = await getTransactions();
  const latestKey = await latestMonthKey(all);
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const key = shiftMonthKey(latestKey, -i);
    const total = all
      .filter((t) => t.type === "transfer" && monthKey(t.transactionDate) === key)
      .reduce((sum, t) => sum + t.amount, 0);
    points.push({ monthKey: key, label: monthLabel(key), amount: total });
  }
  return points;
}

export interface RecurringExpense {
  merchant: string;
  category: Category;
  averageAmount: number;
  occurrences: number;
  lastDate: string;
}

const RECURRING_AMOUNT_TOLERANCE = 0.15; // 15% variance across occurrences

function amountsAreConsistent(amounts: number[]): boolean {
  const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;
  return avg > 0 && amounts.every((a) => Math.abs(a - avg) / avg <= RECURRING_AMOUNT_TOLERANCE);
}

/**
 * "Likely recurring" (PROJECT_SPEC.md §21): either explicitly flagged
 * (`isRecurring`), or the same merchant billed a similar amount in 2+
 * distinct months. One-off repeat purchases (e.g. two different Amazon
 * orders) are deliberately excluded by the amount-consistency check.
 */
export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  const all = await getTransactions();
  const expenses = all.filter((t) => t.type === "expense" && t.merchant);

  const byMerchant = new Map<string, Transaction[]>();
  for (const t of expenses) {
    const list = byMerchant.get(t.merchant!) ?? [];
    list.push(t);
    byMerchant.set(t.merchant!, list);
  }

  const results: RecurringExpense[] = [];
  for (const [merchant, txns] of byMerchant) {
    const distinctMonths = new Set(txns.map((t) => monthKey(t.transactionDate)));
    const explicitlyRecurring = txns.some((t) => t.isRecurring);
    const looksRecurring = distinctMonths.size >= 2 && amountsAreConsistent(txns.map((t) => t.amount));
    if (!explicitlyRecurring && !looksRecurring) continue;

    const averageAmount = txns.reduce((sum, t) => sum + t.amount, 0) / txns.length;
    const lastDate = [...txns].map((t) => t.transactionDate).sort().at(-1)!;
    results.push({ merchant, category: txns[0].category, averageAmount, occurrences: txns.length, lastDate });
  }

  return results.sort((a, b) => b.averageAmount - a.averageAmount);
}
