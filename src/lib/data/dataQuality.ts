import { getTransactions } from "@/lib/data/transactions";
import { findCrossSourceDuplicates } from "@/lib/canonical/reconcile";

export interface DataQualityReport {
  uncategorizedCount: number;
  uncategorizedAmount: number;
  unknownMerchantCount: number;
  possibleDuplicateCount: number;
  lowConfidenceCount: number;
  /** Bank/SMS deposits guessed as "income" with low confidence — needs manual confirmation (never auto-trusted). */
  suspiciousIncomeCount: number;
  ignoredCount: number;
}

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const SUSPICIOUS_INCOME_THRESHOLD = 0.5;

/** Deterministic — no AI involved. See PROJECT_SPEC.md §13, project-spec-truth.md §"DATA QUALITY". */
export async function getDataQualityReport(): Promise<DataQualityReport> {
  const all = await getTransactions();
  const active = all.filter((t) => t.status !== "ignored");

  const uncategorized = active.filter((t) => t.category === "Uncategorized" && t.type === "expense");
  const unknownMerchant = active.filter((t) => !t.merchant);
  const lowConfidence = active.filter((t) => t.confidence < LOW_CONFIDENCE_THRESHOLD);
  const suspiciousIncome = active.filter((t) => t.type === "income" && t.confidence < SUSPICIOUS_INCOME_THRESHOLD);
  const duplicates = findCrossSourceDuplicates(active);

  return {
    uncategorizedCount: uncategorized.length,
    uncategorizedAmount: uncategorized.reduce((sum, t) => sum + t.amount, 0),
    unknownMerchantCount: unknownMerchant.length,
    possibleDuplicateCount: duplicates.length,
    lowConfidenceCount: lowConfidence.length,
    suspiciousIncomeCount: suspiciousIncome.length,
    ignoredCount: all.length - active.length,
  };
}
