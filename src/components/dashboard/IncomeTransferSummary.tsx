import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/format";

interface IncomeTransferSummaryProps {
  incomeTotal: number;
  transferTotal: number;
}

/** Income and transfers are financially distinct from spending (PROJECT_SPEC.md §11). */
export function IncomeTransferSummary({ incomeTotal, transferTotal }: IncomeTransferSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Card className="p-4">
        <p className="text-sm text-muted">Income</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-success">{formatCurrency(incomeTotal)}</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-muted">Transfers</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{formatCurrency(transferTotal)}</p>
        <p className="mt-0.5 text-xs text-muted">Excluded from spending</p>
      </Card>
    </div>
  );
}
