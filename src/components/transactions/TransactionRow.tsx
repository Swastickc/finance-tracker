import type { Transaction } from "@/lib/types";
import { formatRelativeDate, formatSignedCurrency } from "@/lib/format";
import { SOURCE_LABEL } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const isInflow = transaction.type === "income" || transaction.type === "refund";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium">
          {transaction.merchant ?? "Unknown merchant"}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {formatRelativeDate(transaction.transactionDate, transaction.transactionTime)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={transaction.category === "Uncategorized" ? "warning" : "neutral"}>
            {transaction.category}
          </Badge>
          {transaction.status === "review" && <Badge tone="warning">Needs review</Badge>}
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <p
          className={cn(
            "text-[15px] font-semibold tabular-nums",
            isInflow ? "text-success" : "text-foreground"
          )}
        >
          {formatSignedCurrency(transaction.amount, transaction.type, transaction.currency)}
        </p>
        <Badge tone="neutral">{SOURCE_LABEL[transaction.source]}</Badge>
      </div>
    </div>
  );
}
