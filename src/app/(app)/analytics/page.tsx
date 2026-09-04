import {
  getCategoryAnalysis,
  getIncomeAnalysis,
  getMerchantAnalysis,
  getRecurringExpenses,
  getSpendingTrend,
  getTransferAnalysis,
} from "@/lib/data/analytics";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TrendChart } from "@/components/analytics/TrendChart";
import { CategoryAnalysisList } from "@/components/analytics/CategoryAnalysisList";
import { MerchantAnalysisList } from "@/components/analytics/MerchantAnalysisList";
import { RecurringExpensesList } from "@/components/analytics/RecurringExpensesList";
import { formatCurrency } from "@/lib/format";

export default async function AnalyticsPage() {
  const [trend, categories, merchants, income, transfers, recurring] = await Promise.all([
    getSpendingTrend(6),
    getCategoryAnalysis(),
    getMerchantAnalysis(),
    getIncomeAnalysis(6),
    getTransferAnalysis(6),
    getRecurringExpenses(),
  ]);

  const transferTotal = transfers.at(-1)?.amount ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Analytics</h1>

      <section>
        <SectionHeading title="Spending over time" />
        <Card className="p-5">
          <TrendChart points={trend} />
        </Card>
      </section>

      <section>
        <SectionHeading title="Categories" />
        <CategoryAnalysisList items={categories} />
      </section>

      <section>
        <SectionHeading title="Merchants" />
        <MerchantAnalysisList items={merchants} />
      </section>

      <section>
        <SectionHeading title="Income" />
        <Card className="p-5">
          <TrendChart points={income.monthly} tone="success" />
          {income.sources.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              {income.sources.map((s) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
                  <span>{s.source}</span>
                  <span className="font-medium tabular-nums">{formatCurrency(s.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading title="Transfers" />
        <Card className="p-5">
          <p className="text-sm text-muted">
            {formatCurrency(transferTotal)} this month · excluded from spending totals
          </p>
          <div className="mt-3">
            <TrendChart points={transfers} tone="muted" />
          </div>
        </Card>
      </section>

      <section>
        <SectionHeading title="Recurring expenses" />
        <RecurringExpensesList items={recurring} />
      </section>
    </div>
  );
}
