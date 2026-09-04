import type { Transaction } from "@/lib/types";

export interface CrossSourceMatch {
  a: string;
  b: string;
  confidence: "high" | "medium";
  reason: string;
}

function normalizedText(t: Transaction): string {
  return (t.merchant ?? t.rawDescription).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

/**
 * Conservative, cross-source "possible duplicate" detector (project-spec-truth.md
 * §"DEDUPLICATION / RECONCILIATION"). A single real-world purchase can produce
 * an SMS, an email, and a bank-statement row — this NEVER merges or deletes
 * anything; it only reports candidate pairs for the Review queue / Data
 * Quality to surface. Same-source pairs are left to that source's own
 * reconciliation (e.g. bank<->bank overlap is handled in bank/reconcile.ts).
 */
export function findCrossSourceDuplicates(transactions: Transaction[]): CrossSourceMatch[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (t.status === "ignored") continue;
    const key = `${t.transactionDate}|${t.amount}`;
    const group = groups.get(key) ?? [];
    group.push(t);
    groups.set(key, group);
  }

  const matches: CrossSourceMatch[] = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.source === b.source) continue; // same-source dedup is handled elsewhere

        const textA = normalizedText(a);
        const textB = normalizedText(b);
        const overlaps = Boolean(textA) && Boolean(textB) && (textA.includes(textB) || textB.includes(textA));

        matches.push({
          a: a.id,
          b: b.id,
          confidence: overlaps ? "high" : "medium",
          reason: `same date (${a.transactionDate}) and amount (${a.amount}) across ${a.source} and ${b.source}${overlaps ? " — overlapping merchant/description text" : ""}`,
        });
      }
    }
  }

  return matches;
}
