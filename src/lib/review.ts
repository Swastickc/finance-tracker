import type { Transaction } from "@/lib/types";

export type ReviewReason = "unknown_merchant" | "uncategorized" | "low_confidence" | "possible_duplicate";

export interface ReviewItem {
  transaction: Transaction;
  reasons: ReviewReason[];
  duplicateOf: Transaction | null;
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;

function duplicateKey(t: Transaction): string {
  // date+amount+type (not merchant) — bank-statement rows never have a
  // merchant (see bank/normalize.ts), so requiring it silently excluded
  // every bank transaction from ever being matched against Gmail/SMS.
  // Loose on purpose: false positives are expected and fine here (surfaced
  // as "possible_duplicate" for human review, never auto-resolved).
  return `${t.transactionDate}|${t.amount}|${t.type}`;
}

/**
 * Pure and deterministic — no AI involved (PROJECT_SPEC.md §13, §20).
 * A transaction enters the queue only via its own `status: "review"` flag;
 * `reasons`/`duplicateOf` are derived purely for context and action gating.
 */
export function buildReviewQueue(transactions: Transaction[]): ReviewItem[] {
  const active = transactions.filter((t) => t.status !== "ignored");

  const byKey = new Map<string, Transaction[]>();
  for (const t of active) {
    const key = duplicateKey(t);
    const bucket = byKey.get(key) ?? [];
    bucket.push(t);
    byKey.set(key, bucket);
  }

  return active
    .filter((t) => t.status === "review")
    .map((t) => {
      const reasons: ReviewReason[] = [];
      if (!t.merchant) reasons.push("unknown_merchant");
      if (t.category === "Uncategorized") reasons.push("uncategorized");
      if (t.confidence < LOW_CONFIDENCE_THRESHOLD) reasons.push("low_confidence");

      const key = duplicateKey(t);
      const duplicateOf = (byKey.get(key) ?? []).find((other) => other.id !== t.id) ?? null;
      if (duplicateOf) reasons.push("possible_duplicate");

      return { transaction: t, reasons, duplicateOf };
    })
    .sort((a, b) =>
      `${b.transaction.transactionDate}${b.transaction.transactionTime ?? ""}`.localeCompare(
        `${a.transaction.transactionDate}${a.transaction.transactionTime ?? ""}`
      )
    );
}
