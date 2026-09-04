import { Receipt } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionRow } from "@/components/transactions/TransactionRow";

export function RecentTransactionsList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Receipt size={28} />}
        title="No transactions yet"
        description="Transactions from SMS, Gmail, or manual entry will show up here."
      />
    );
  }

  return (
    <Card className="divide-y divide-border">
      {transactions.map((t) => (
        <TransactionRow key={t.id} transaction={t} />
      ))}
    </Card>
  );
}
