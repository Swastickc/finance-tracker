import { getTransactions } from "@/lib/data/transactions";
import { TransactionsView } from "@/components/transactions/TransactionsView";

// Shipping every transaction (now 3000+) to the client blew past the
// Worker's resource limits. Capped to the most recent N for now — full
// search/pagination across all history is a follow-up, not a regression
// from anything that worked before (nothing this large existed before the
// bulk Gmail import).
const PAGE_SIZE = 500;

export default async function TransactionsPage() {
  const all = await getTransactions();

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Transactions</h1>
        {all.length > PAGE_SIZE && (
          <p className="text-sm text-muted">Showing most recent {PAGE_SIZE} of {all.length}</p>
        )}
      </div>
      <TransactionsView initialTransactions={all.slice(0, PAGE_SIZE)} />
    </div>
  );
}
