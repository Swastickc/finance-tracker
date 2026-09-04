import type { MerchantStat } from "@/lib/data/analytics";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChangeLabel } from "@/components/analytics/TrendChart";
import { formatCurrency } from "@/lib/format";
import { Store } from "lucide-react";

export function MerchantAnalysisList({ items }: { items: MerchantStat[] }) {
  if (items.length === 0) {
    return <EmptyState icon={<Store size={28} />} title="No merchant data yet" description="Your top merchants this month will appear here." />;
  }

  return (
    <Card className="divide-y divide-border">
      {items.slice(0, 8).map((item) => (
        <div key={item.merchant} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px]">{item.merchant}</p>
            <p className="text-xs text-muted">
              {item.transactionCount} transaction{item.transactionCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[15px] font-medium tabular-nums">{formatCurrency(item.totalSpend)}</p>
            <ChangeLabel changePercent={item.changePercent} />
          </div>
        </div>
      ))}
    </Card>
  );
}
