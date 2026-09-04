import { getTransactions, getCategoryRules } from "@/lib/data/transactions";
import { ReviewQueueView } from "@/components/review/ReviewQueueView";

export default async function ReviewPage() {
  const [transactions, rules] = await Promise.all([getTransactions(), getCategoryRules()]);

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Review</h1>
      <ReviewQueueView initialTransactions={transactions} initialRules={rules} />
    </div>
  );
}
