import { buildScanQuery } from "@/lib/gmail/known-senders";
import { getMessage, getMessageMetadata, listMessageIds } from "@/lib/gmail/client";
import { parseEmail } from "@/lib/gmail/parse";
import { appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow } from "@/lib/canonical/sheetSchema";
import { filterAmbiguousMessageIds, filterNewMessageIds, getScanStateStore } from "@/lib/gmail/scanState";
import { formatInTimeZone, IST_TIME_ZONE } from "@/lib/gmail/timezone";
import type { Transaction } from "@/lib/types";
import type { DryRunItem, DryRunResult, ImportOutcome, ScanResult } from "@/lib/gmail/types";
import type { GmailImporter } from "@/lib/gmail/providers/types";

const SCAN_MESSAGE_CAP = 3000;
const SCAN_METADATA_SAMPLE = 150;
const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";

export class LiveGmailImporter implements GmailImporter {
  async scan(): Promise<ScanResult> {
    const store = await getScanStateStore();
    const ids = await listMessageIds(buildScanQuery(), SCAN_MESSAGE_CAP);
    const sample = ids.slice(0, SCAN_METADATA_SAMPLE);
    const metas = await Promise.all(sample.map((id) => getMessageMetadata(id)));

    const bySender = new Map<string, number>();
    let earliest: string | null = null;
    let latest: string | null = null;
    for (const meta of metas) {
      const sender = meta.from.split("<")[0].trim() || meta.from;
      bySender.set(sender, (bySender.get(sender) ?? 0) + 1);
      const date = new Date(meta.date);
      if (!Number.isNaN(date.getTime())) {
        const iso = date.toISOString().slice(0, 10);
        if (!earliest || iso < earliest) earliest = iso;
        if (!latest || iso > latest) latest = iso;
      }
    }

    // newMessageIds excludes anything already pending/importing/imported/ambiguous;
    // ambiguousMessageIds is reported separately for manual verification and is
    // NEVER folded into newMessageIds (never auto-retried — see scanState.ts).
    const [newMessageIds, ambiguousMessageIds] = await Promise.all([
      filterNewMessageIds(store, ids),
      filterAmbiguousMessageIds(store, ids),
    ]);
    await store.markPending(ids); // seen from now on, but still revisitable via dry-run/import

    return {
      scannedAt: new Date().toISOString(),
      messagesFound: ids.length,
      candidateSenders: [...bySender.entries()]
        .map(([sender, count]) => ({ sender, count }))
        .sort((a, b) => b.count - a.count),
      dateRangeStart: earliest,
      dateRangeEnd: latest,
      candidateMessageIds: ids,
      newMessageIds,
      ambiguousMessageIds,
    };
  }

  async dryRun(messageIds: string[]): Promise<DryRunResult> {
    const settled = await Promise.allSettled(messageIds.map((id) => getMessage(id)));
    const parserFailureCount = settled.filter((s) => s.status === "rejected").length;
    const messages = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));

    const items: DryRunItem[] = messages.map((m) => {
      const parsed = parseEmail(m.from, m.subject, m.body);
      return {
        messageId: m.id,
        sender: m.from,
        subject: m.subject,
        date: m.date,
        classification: parsed.classification,
        nonTransactionReason: parsed.nonTransactionReason,
        detectedAmount: parsed.detectedAmount,
        merchant: parsed.merchant,
        type: parsed.type,
        category: parsed.category,
        confidence: parsed.confidence,
        classificationNote: parsed.classificationNote,
        possibleDuplicateOfMessageId: null,
        warnings: parsed.warnings,
      };
    });

    flagWithinBatchDuplicates(items);

    return { runAt: new Date().toISOString(), items, parserFailureCount };
  }

  /**
   * Claim-before-write import flow (see scanState.ts module doc comment for
   * the full rationale). Never appends to Sheets for a message that's
   * already imported, already importing (including stale/ambiguous — those
   * are NEVER auto-retried), or that a concurrent request just claimed.
   *
   * Sheets append granularity assumption: `appendSheetValues` makes exactly
   * one HTTP call to `values:append` for the whole batch, and the Sheets API
   * gives no per-row success/failure signal within a single call — it is
   * all-or-nothing from this application's perspective (the call either
   * resolves, meaning every row in it was appended, or throws, meaning we
   * cannot prove any row was appended). Claiming and finalizing the entire
   * batch together is therefore the correct granularity; splitting it up
   * would invent a precision the underlying API doesn't provide.
   *
   * If the append throws, we do NOT know whether Sheets actually received it
   * (a thrown error here also covers "we never got a response," not just "we
   * got a response so did throw") — so claimed messages are deliberately
   * left in "importing" rather than released back to "pending". They surface
   * as "ambiguous" after the timeout for manual verification, never an
   * automatic retry, since retrying could create a real duplicate row.
   */
  async importItems(items: DryRunItem[]): Promise<ImportOutcome> {
    const startedAt = new Date().toISOString();
    const store = await getScanStateStore();

    // Only genuinely classified transactions are ever candidates — NON_TRANSACTION
    // and UNKNOWN items are never imported, regardless of whether an amount
    // was incidentally detected in them.
    const importable = items.filter(
      (i) => i.classification === "TRANSACTION" && i.detectedAmount !== null && i.type !== null
    );

    // Defensive de-dup: a client could submit the same message ID twice in
    // one request; keep only the first occurrence before claiming.
    const seenIds = new Set<string>();
    const candidates = importable.filter((i) => (seenIds.has(i.messageId) ? false : (seenIds.add(i.messageId), true)));

    const claimResults = await Promise.all(candidates.map((item) => store.tryClaim(item.messageId)));
    const claimed = candidates.filter((_, i) => claimResults[i]);
    // Counts BOTH kinds of skip as "duplicate": already imported/importing/
    // ambiguous in the store, and duplicate message IDs within this same
    // request (collapsed before claiming, so they never reach tryClaim at all).
    const skippedAlreadyClaimed = importable.length - claimed.length;

    const rows = claimed.map((item): Transaction => {
      const now = new Date().toISOString();
      return {
        id: `gmail-${item.messageId}`,
        transactionDate: parseHeaderDate(item.date),
        transactionTime: parseHeaderTime(item.date),
        amount: item.detectedAmount!,
        currency: "INR",
        type: item.type!,
        merchant: item.merchant,
        rawDescription: `${item.subject} — ${item.sender}`,
        category: (item.category as Transaction["category"]) ?? "Uncategorized",
        subcategory: null,
        account: null,
        paymentMethod: null,
        // Individual Gmail message ID, never the thread ID (project-spec-truth.md
        // §"HISTORICAL GMAIL": "Gmail thread ID must NOT be treated as the
        // transaction ID"). listMessageIds() only ever extracts `.id`, not
        // `.threadId`, from the Gmail API response — see gmail/client.ts.
        source: "gmail",
        sourceMessageId: item.messageId,
        // Always "review": this is a historical, unverified import (PROJECT_SPEC.md §20).
        status: "review",
        confidence: item.confidence === "high" ? 0.85 : item.confidence === "medium" ? 0.65 : 0.4,
        isRecurring: false,
        ruleId: null,
        classificationNote: item.possibleDuplicateOfMessageId
          ? `${item.classificationNote}; possible duplicate notification of message ${item.possibleDuplicateOfMessageId}`
          : item.classificationNote,
        createdAt: now,
        updatedAt: now,
      };
    });

    let errors = 0;
    let transactionsImported = 0;
    if (rows.length > 0) {
      try {
        await appendSheetValues(GMAIL_IMPORT_RANGE, rows.map(transactionToRow));
        // Sheets append confirmed — finalize the claim. If THIS throws, the
        // claimed messages stay "importing" (never silently "imported", never
        // released back to "pending") and surface as ambiguous once stale.
        await store.markImported(rows.map((r) => r.sourceMessageId!));
        transactionsImported = rows.length;
      } catch {
        // Append failed OR finalize failed after a successful append — in
        // both cases we cannot prove the append didn't happen, so the claim
        // is deliberately left "importing" rather than assumed safe to retry.
        errors = rows.length;
      }
    }

    return {
      importId: `imp-gmail-${Date.now()}`,
      source: "gmail",
      startedAt,
      completedAt: new Date().toISOString(),
      messagesScanned: items.length,
      transactionsDetected: importable.length,
      transactionsImported,
      // Messages already imported/importing/ambiguous (or duplicated within this
      // request) that were therefore never sent to Sheets at all.
      duplicates: skippedAlreadyClaimed,
      errors,
      status: errors === 0 ? "completed" : "failed",
    };
  }
}

/**
 * Flags messages within the same dry-run batch that look like duplicate
 * notifications for the same underlying transaction (same date + amount +
 * merchant) — e.g. an "order confirmed" email and a separate "payment
 * received" email for one purchase. Never removes anything; only annotates
 * `possibleDuplicateOfMessageId` for Review, mirroring the conservative
 * cross-source matcher in src/lib/canonical/reconcile.ts.
 */
function flagWithinBatchDuplicates(items: DryRunItem[]): void {
  const seen = new Map<string, string>(); // fingerprint -> first messageId
  for (const item of items) {
    if (item.classification !== "TRANSACTION" || item.detectedAmount === null) continue;
    const dateOnly = parseHeaderDate(item.date);
    const key = `${dateOnly}|${item.detectedAmount}|${item.merchant ?? ""}`;
    const firstId = seen.get(key);
    if (firstId) {
      item.possibleDuplicateOfMessageId = firstId;
      item.warnings.push(`Possible duplicate notification of message ${firstId} (same date, amount, and merchant).`);
    } else {
      seen.set(key, item.messageId);
    }
  }
}

/** Exported for direct unit testing of the RFC 2822 -> IST conversion. */
export function parseHeaderDate(rfc2822: string): string {
  const date = new Date(rfc2822);
  return formatInTimeZone(Number.isNaN(date.getTime()) ? new Date() : date, IST_TIME_ZONE).date;
}

export function parseHeaderTime(rfc2822: string): string | null {
  const date = new Date(rfc2822);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, IST_TIME_ZONE).time;
}
