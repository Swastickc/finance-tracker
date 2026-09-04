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
  /** Subset of candidateMessageIds never seen by a previous scan (project-spec-truth.md §"ONGOING GMAIL"). */
  newMessageIds: string[];
  /** Subset of candidateMessageIds stuck "importing" past the ambiguity timeout — needs manual verification against the Sheet, never auto-retried. */
  ambiguousMessageIds: string[];
}

export type DryRunConfidence = "high" | "medium" | "low";

export type GmailClassification = "TRANSACTION" | "NON_TRANSACTION" | "UNKNOWN";

export type NonTransactionReason = "otp" | "due_reminder" | "promotional" | null;

export interface DryRunItem {
  messageId: string;
  sender: string;
  subject: string;
  date: string;
  classification: GmailClassification;
  nonTransactionReason: NonTransactionReason;
  detectedAmount: number | null;
  merchant: string | null;
  type: "expense" | "income" | "refund" | "transfer" | null;
  category: string | null;
  confidence: DryRunConfidence;
  /** Human-readable — feeds Transaction.classificationNote on import. */
  classificationNote: string;
  /** Set when another item in the same dry-run batch shares date+amount+merchant (project-spec-truth.md: duplicate notifications for the same transaction). */
  possibleDuplicateOfMessageId: string | null;
  warnings: string[];
}

export interface DryRunResult {
  runAt: string;
  items: DryRunItem[];
  /** Messages that failed to fetch/parse entirely (e.g. Gmail API errors) — distinct from NON_TRANSACTION/UNKNOWN classification. */
  parserFailureCount: number;
}

export interface ImportOutcome {
  importId: string;
  source: "gmail";
  startedAt: string;
  completedAt: string;
  messagesScanned: number;
  transactionsDetected: number;
  transactionsImported: number;
  /** Candidates that were already imported/importing/ambiguous (or duplicated within this request) and were therefore never sent to Sheets. */
  duplicates: number;
  errors: number;
  status: "completed" | "failed";
}
