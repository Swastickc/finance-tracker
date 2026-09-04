import type { DryRunItem, DryRunResult, ImportOutcome, ScanResult } from "@/lib/gmail/types";

export interface GmailImporter {
  scan(): Promise<ScanResult>;
  dryRun(messageIds: string[]): Promise<DryRunResult>;
  importItems(items: DryRunItem[]): Promise<ImportOutcome>;
}
