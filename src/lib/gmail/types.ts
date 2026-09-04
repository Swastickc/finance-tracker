export interface GmailMessageMeta {
  id: string;
  from: string;
  subject: string;
  /** RFC 2822 date header, as returned by Gmail. */
  date: string;
  snippet: string;
}

export interface ScanResult {
  scannedAt: string;
  messagesFound: number;
  candidateSenders: { sender: string; count: number }[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  /** Message IDs to hand to dryRun(); kept small and paged in the live provider. */
  candidateMessageIds: string[];
}

export type DryRunConfidence = "high" | "medium" | "low";

export interface DryRunItem {
  messageId: string;
  sender: string;
  subject: string;
  date: string;
  detectedAmount: number | null;
  merchant: string | null;
  type: "expense" | "income" | "refund" | null;
  category: string | null;
  confidence: DryRunConfidence;
  warnings: string[];
}

export interface DryRunResult {
  runAt: string;
  items: DryRunItem[];
}

export interface ImportOutcome {
  importId: string;
  source: "gmail";
  startedAt: string;
  completedAt: string;
  messagesScanned: number;
  transactionsDetected: number;
  transactionsImported: number;
  duplicates: number;
  errors: number;
  status: "completed" | "failed";
}
