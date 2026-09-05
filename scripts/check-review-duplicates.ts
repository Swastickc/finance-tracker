#!/usr/bin/env tsx
// Quick diagnostic: how many of the newly-imported Gmail transactions are
// flagged as possible cross-source duplicates against existing SMS/Bank rows?
try {
  process.loadEnvFile?.(".env");
} catch {
  // no .env in CI
}

import { GoogleSheetsTransactionProvider } from "@/lib/data/providers/sheets-provider";
import { buildReviewQueue } from "@/lib/review";

async function main() {
  const provider = new GoogleSheetsTransactionProvider();
  const all = await provider.listTransactions();
  console.log(`Total transactions across all sources: ${all.length}`);

  const bySource = new Map<string, number>();
  for (const t of all) bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1);
  console.log("By source:", Object.fromEntries(bySource));

  const queue = buildReviewQueue(all);
  console.log(`Review queue size: ${queue.length}`);
  const withDup = queue.filter((i) => i.duplicateOf !== null);
  console.log(`Flagged as possible cross-source duplicate: ${withDup.length}`);
  for (const item of withDup.slice(0, 10)) {
    console.log(
      `  ${item.transaction.source}/${item.transaction.id} (${item.transaction.transactionDate}, ${item.transaction.amount}, ${item.transaction.merchant}) <-> ${item.duplicateOf!.source}/${item.duplicateOf!.id}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
