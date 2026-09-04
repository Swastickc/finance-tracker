import type { RecurringExpense } from "@/lib/data/analytics";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { Repeat } from "lucide-react";

export function RecurringExpensesList({ items }: { items: RecurringExpense[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Repeat size={28} />}
        title="No recurring expenses detected"
        description="Subscriptions and other regularly repeating charges will appear here once a consistent pattern emerges."
      />
    );
  }

  return (
    <Card className="divide-y divide-border">
      {items.map((item) => (
        <div key={item.merchant} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[15px]">{item.merchant}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone="neutral">{item.category}</Badge>
              <span className="text-xs text-muted">Last {formatDate(item.lastDate)}</span>
            </div>
          </div>
          <p className="flex-shrink-0 text-[15px] font-medium tabular-nums">~{formatCurrency(item.averageAmount)}/mo</p>
        </div>
      ))}
    </Card>
  );
}
