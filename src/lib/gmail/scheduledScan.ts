// Incremental Gmail scan+import invoked by the Cron Trigger (see
// custom-worker.ts / wrangler.jsonc "triggers.crons"). Reuses the same
// tested client/parse/sheets modules the UI's Gmail import panel uses, but
// bypasses getScanStateStore()'s Next-request-specific D1 resolution since a
// scheduled() handler has no Next.js request context — the real D1 binding
// is passed in directly via `env`.
//
// Deliberately conservative and small per run (see SCHEDULED_SCAN_CAP):
// Workers scheduled handlers have execution time limits, and this only ever
// needs to catch up on messages since the last run, not reprocess history
// (that one-time backfill is scripts/gmail-bulk-import.ts). Only
// classification === "TRANSACTION" with confidence "high"/"medium" is
// auto-imported; everything else is left for manual review in the app's
// Review page, exactly like the UI's own default pre-selection.

import { listMessageIds, getMessage } from "@/lib/gmail/client";
import { buildScanQuery } from "@/lib/gmail/known-senders";
import { parseEmail } from "@/lib/gmail/parse";
import { parseHeaderDate, parseHeaderTime } from "@/lib/gmail/providers/live-gmail-provider";
import { D1ScanStateStore, filterNewMessageIds, type D1DatabaseLike } from "@/lib/gmail/scanState";
import { appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow } from "@/lib/canonical/sheetSchema";
import type { Transaction } from "@/lib/types";

const SCHEDULED_SCAN_CAP = 200; // how many recent candidate ids to look at per run
const SCHEDULED_IMPORT_CAP = 50; // how many NEW messages to actually fetch+classify per run (stays well within Worker execution limits)
const MIN_REQUEST_INTERVAL_MS = 300;
const GMAIL_IMPORT_RANGE = () => process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";

const REQUIRED_ENV_KEYS = [
  "GMAIL_SOURCE",
  "DATA_SOURCE",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_GMAIL_IMPORT_RANGE",
] as const;

export interface ScheduledScanEnv {
  GMAIL_SCAN_STATE_DB?: D1DatabaseLike;
  [key: string]: unknown;
}

/** Maps Worker env bindings/vars onto process.env so the existing process.env-based auth/client modules work unchanged outside of a Next.js request. */
function hydrateProcessEnv(env: ScheduledScanEnv): void {
  for (const key of REQUIRED_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.length > 0) process.env[key] = value;
  }
}

export interface ScheduledScanResult {
  ranAt: string;
  skippedReason?: string;
  candidatesFound: number;
  newMessagesConsidered: number;
  imported: number;
  skippedForReview: number;
  errors: number;
}

export async function runScheduledGmailScan(env: ScheduledScanEnv): Promise<ScheduledScanResult> {
  const ranAt = new Date().toISOString();
  hydrateProcessEnv(env);

  if (process.env.GMAIL_SOURCE !== "live" || process.env.DATA_SOURCE !== "sheets") {
    return { ranAt, skippedReason: "GMAIL_SOURCE/DATA_SOURCE not set to live/sheets", candidatesFound: 0, newMessagesConsidered: 0, imported: 0, skippedForReview: 0, errors: 0 };
  }
  if (!env.GMAIL_SCAN_STATE_DB) {
    return { ranAt, skippedReason: "GMAIL_SCAN_STATE_DB binding missing", candidatesFound: 0, newMessagesConsidered: 0, imported: 0, skippedForReview: 0, errors: 0 };
  }

  const store = new D1ScanStateStore(env.GMAIL_SCAN_STATE_DB);
  const candidateIds = await listMessageIds(buildScanQuery(), SCHEDULED_SCAN_CAP);
  const newIds = (await filterNewMessageIds(store, candidateIds)).slice(0, SCHEDULED_IMPORT_CAP);
  await store.markPending(candidateIds);

  let lastRequestAt = 0;
  async function throttle(): Promise<void> {
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
  }

  const accepted: Transaction[] = [];
  let skippedForReview = 0;
  let errors = 0;

  for (const id of newIds) {
    await throttle();
    try {
      const msg = await getMessage(id);
      const parsed = parseEmail(msg.from, msg.subject, msg.body);
      const isAutoImportable =
        parsed.classification === "TRANSACTION" && parsed.detectedAmount !== null && parsed.type !== null && parsed.confidence !== "low";

      if (!isAutoImportable) {
        skippedForReview++;
        continue;
      }

      const claimed = await store.tryClaim(id);
      if (!claimed) continue; // already claimed/imported by a concurrent run

      const now = new Date().toISOString();
      accepted.push({
        id: `gmail-${id}`,
        transactionDate: parseHeaderDate(msg.date),
        transactionTime: parseHeaderTime(msg.date),
        amount: parsed.detectedAmount!,
        currency: "INR",
        type: parsed.type!,
        merchant: parsed.merchant,
        rawDescription: `${msg.subject} — ${msg.from}`,
        category: (parsed.category as Transaction["category"]) ?? "Uncategorized",
        subcategory: null,
        account: null,
        paymentMethod: null,
        source: "gmail",
        sourceMessageId: id,
        status: "review",
        confidence: parsed.confidence === "high" ? 0.85 : 0.65,
        isRecurring: false,
        ruleId: null,
        classificationNote: parsed.classificationNote,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      errors++;
      console.error(`[scheduled-gmail-scan] failed to process ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  if (accepted.length > 0) {
    try {
      await appendSheetValues(GMAIL_IMPORT_RANGE(), accepted.map(transactionToRow));
      await store.markImported(accepted.map((t) => t.sourceMessageId!));
    } catch (err) {
      // Claimed but not confirmed written — left "importing" on purpose (see
      // scanState.ts doc comment), will surface as "ambiguous" for manual
      // review rather than being silently retried or lost.
      console.error("[scheduled-gmail-scan] Sheets append/finalize failed:", err);
      errors += accepted.length;
    }
  }

  return {
    ranAt,
    candidatesFound: candidateIds.length,
    newMessagesConsidered: newIds.length,
    imported: accepted.length,
    skippedForReview,
    errors,
  };
}
