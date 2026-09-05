import { getCategoryRules } from "@/lib/data/transactions";
import { getReviewQueue } from "@/lib/data/review";
import { ReviewQueueView } from "@/components/review/ReviewQueueView";

// Shipping the full review queue (currently thousands of items, since most
// historical imports start as status:"review") to a client component blew
// past the Worker's resource limits. The queue itself is still built
// server-side from the complete dataset (correct duplicate detection), only
// what's sent to the browser is capped.
const PAGE_SIZE = 150;

export default async function ReviewPage() {
  const [queue, rules] = await Promise.all([getReviewQueue(), getCategoryRules()]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-[28px] font-semibold tracking-tight">Review</h1>
        {queue.length > PAGE_SIZE && (
          <p className="text-sm text-muted">Showing {PAGE_SIZE} of {queue.length}</p>
        )}
      </div>
      <ReviewQueueView initialQueue={queue.slice(0, PAGE_SIZE)} initialRules={rules} />
    </div>
  );
}
