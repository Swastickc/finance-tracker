import { PieChart } from "lucide-react";
import type { CategoryTotal } from "@/lib/data/transactions";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format";

/** Reused by Analytics in a later phase — keep this dashboard-agnostic. */
export function CategoryBreakdown({ categoryTotals }: { categoryTotals: CategoryTotal[] }) {
  if (categoryTotals.length === 0) {
    return (
      <EmptyState
        icon={<PieChart size={28} />}
        title="No spending yet"
        description="Categorized expenses for this month will appear here."
      />
    );
  }

  const categorySum = categoryTotals.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Card className="divide-y divide-border">
      {categoryTotals.map((c) => {
        const share = categorySum > 0 ? Math.round((c.amount / categorySum) * 100) : 0;
        return (
          <div key={c.category} className="flex items-center justify-between px-4 py-3">
            <span className="flex items-baseline gap-2 text-[15px]">
              {c.category}
              <span className="text-xs text-muted">{share}%</span>
            </span>
            <span className="text-[15px] font-medium tabular-nums">{formatCurrency(c.amount)}</span>
          </div>
        );
      })}
    </Card>
  );
}
