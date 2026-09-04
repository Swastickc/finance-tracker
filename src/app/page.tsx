import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getMonthlySummary } from "@/lib/data/transactions";
import { formatCurrency, formatPercent } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { IncomeTransferSummary } from "@/components/dashboard/IncomeTransferSummary";
import { RecentTransactionsList } from "@/components/dashboard/RecentTransactionsList";

export default async function OverviewPage() {
  const summary = await getMonthlySummary();
  const monthLabel = new Date(`${summary.monthKey}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Overview</h1>

      <StatCard
        label={`Spent in ${monthLabel}`}
        value={formatCurrency(summary.totalSpend)}
        delta={
          summary.changePercent !== null
            ? { label: `${formatPercent(summary.changePercent)} vs last month`, positive: summary.changePercent > 0 }
            : undefined
        }
      />

      <IncomeTransferSummary incomeTotal={summary.incomeTotal} transferTotal={summary.transferTotal} />

      <Card className="flex items-start gap-3 p-5">
        <Sparkles className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-muted">AI insight</p>
          <p className="mt-1 text-[15px]">
            Finance AI is coming in a later phase. Once connected, insights about your spending
            patterns will appear here — grounded only in the numbers shown on this page.
          </p>
        </div>
      </Card>

      {summary.uncategorizedSpend > 0 && (
        <Link href="/review" className="block">
          <Card className="flex items-center justify-between p-4">
            <p className="text-[15px] font-medium">
              {formatCurrency(summary.uncategorizedSpend)}{" "}
              <span className="text-muted">needs review</span>
            </p>
            <Badge tone="warning">{summary.reviewCount} to review</Badge>
          </Card>
        </Link>
      )}

      <section>
        <SectionHeading title="Categories" />
        <CategoryBreakdown categoryTotals={summary.categoryTotals} />
      </section>

      <section>
        <SectionHeading
          title="Recent transactions"
          action={
            <Link href="/transactions" className="text-sm font-medium text-accent">
              See all
            </Link>
          }
        />
        <RecentTransactionsList transactions={summary.recentTransactions} />
      </section>
    </div>
  );
}
