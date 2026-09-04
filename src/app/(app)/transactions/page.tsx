import { getTransactions } from "@/lib/data/transactions";
import { TransactionsView } from "@/components/transactions/TransactionsView";

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Transactions</h1>
      <TransactionsView initialTransactions={transactions} />
    </div>
  );
}
