import type { CategoryTrend } from "@/lib/data/analytics";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChangeLabel } from "@/components/analytics/TrendChart";
import { formatCurrency } from "@/lib/format";
import { PieChart } from "lucide-react";

export function CategoryAnalysisList({ items }: { items: CategoryTrend[] }) {
  if (items.length === 0) {
    return <EmptyState icon={<PieChart size={28} />} title="No category data yet" description="Categorized spending will appear here." />;
  }

  return (
    <Card className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.category} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[15px]">{item.category}</p>
            <p className="text-xs text-muted">{item.percentOfSpend}% of spend</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[15px] font-medium tabular-nums">{formatCurrency(item.amount)}</p>
            <ChangeLabel changePercent={item.changePercent} />
          </div>
        </div>
      ))}
    </Card>
  );
}
