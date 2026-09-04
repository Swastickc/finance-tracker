import type { TransactionProvider } from "@/lib/data/providers/types";
import { MockTransactionProvider } from "@/lib/data/providers/mock-provider";
import { GoogleSheetsTransactionProvider } from "@/lib/data/providers/sheets-provider";

let cached: TransactionProvider | null = null;

/** DATA_SOURCE=sheets opts into Google Sheets; anything else (default) stays on mock data. */
export function getTransactionProvider(): TransactionProvider {
  if (!cached) {
    cached =
      process.env.DATA_SOURCE === "sheets"
        ? new GoogleSheetsTransactionProvider()
        : new MockTransactionProvider();
  }
  return cached;
}
