import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Transactions</h1>
      <EmptyState
        icon={<Receipt size={28} />}
        title="Transaction history is coming soon"
        description="Search, filters, and the full transaction list will appear here once connected to real data."
      />
    </div>
  );
}
