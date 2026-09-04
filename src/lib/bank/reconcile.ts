import type { Transaction } from "@/lib/types";

export interface BankReconciliationResult {
  /** Same length/order as input — exact duplicates are kept but marked status:"ignored", never removed. */
  transactions: Transaction[];
  exactDuplicateCount: number;
  /** Same date+amount+type but different remarks — not confident enough to auto-resolve; surfaced for Review. */
  possibleDuplicates: { a: string; b: string }[];
}

function exactFingerprint(t: Transaction): string {
  const remarks = t.rawDescription.trim().toLowerCase().replace(/\s+/g, " ");
  return `${t.transactionDate}|${t.amount}|${t.type}|${remarks}`;
}

function looseFingerprint(t: Transaction): string {
  return `${t.transactionDate}|${t.amount}|${t.type}`;
}

/**
 * Conservative overlap detection across one or more bank-statement imports
 * (project-spec-truth.md §"HISTORICAL EXCEL IMPORT / RECONCILIATION").
 *
 * - Exact match (date + amount + type + normalized remarks): confident
 *   enough to auto-resolve — the later occurrence is marked `ignored`
 *   (never deleted) with provenance pointing at the row it duplicates.
 * - Same date + amount + type but different remarks: NOT confident enough
 *   to resolve automatically — both are kept as-is and reported as a
 *   possible-duplicate pair for human review, per the "never silently
 *   delete an uncertain match" rule.
 */
export function reconcileBankTransactions(transactions: Transaction[]): BankReconciliationResult {
  const seenExact = new Map<string, Transaction>();
  const looseGroups = new Map<string, Transaction[]>();
  const result: Transaction[] = [];
  let exactDuplicateCount = 0;

  for (const t of transactions) {
    const exact = exactFingerprint(t);
    const existing = seenExact.get(exact);

    if (existing) {
      exactDuplicateCount += 1;
      result.push({
        ...t,
        status: "ignored",
        classificationNote: `bank-reconciliation: exact duplicate of ${existing.id} (same date, amount, type, remarks) — auto-marked ignored, not deleted`,
      });
      continue;
    }

    seenExact.set(exact, t);
    result.push(t);

    const loose = looseFingerprint(t);
    const group = looseGroups.get(loose) ?? [];
    group.push(t);
    looseGroups.set(loose, group);
  }

  const possibleDuplicates: { a: string; b: string }[] = [];
  for (const group of looseGroups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        possibleDuplicates.push({ a: group[i].id, b: group[j].id });
      }
    }
  }

  return { transactions: result, exactDuplicateCount, possibleDuplicates };
}
