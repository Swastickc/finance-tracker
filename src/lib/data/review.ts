import { getTransactions } from "@/lib/data/transactions";
import { buildReviewQueue } from "@/lib/review";

export async function getReviewQueue() {
  return buildReviewQueue(await getTransactions());
}
