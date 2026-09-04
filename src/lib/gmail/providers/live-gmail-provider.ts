import { buildScanQuery } from "@/lib/gmail/known-senders";
import { getMessage, getMessageMetadata, listMessageIds } from "@/lib/gmail/client";
import { parseEmail } from "@/lib/gmail/parse";
import { appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow } from "@/lib/canonical/sheetSchema";
import { isNewMessage, markImported, markPending } from "@/lib/gmail/scanState";
import { formatInTimeZone, IST_TIME_ZONE } from "@/lib/gmail/timezone";
import type { Transaction } from "@/lib/types";
import type { DryRunItem, DryRunResult, ImportOutcome, ScanResult } from "@/lib/gmail/types";
import type { GmailImporter } from "@/lib/gmail/providers/types";

const SCAN_MESSAGE_CAP = 200;
const SCAN_METADATA_SAMPLE = 50;
const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";

export class LiveGmailImporter implements GmailImporter {
  async scan(): Promise<ScanResult> {
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

    const newMessageIds = ids.filter(isNewMessage);
    markPending(ids); // seen from now on, but still revisitable via dry-run/import

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

  async importItems(items: DryRunItem[]): Promise<ImportOutcome> {
    const startedAt = new Date().toISOString();
    // Only genuinely classified transactions are ever written — NON_TRANSACTION
    // and UNKNOWN (ambiguous) items are never imported, regardless of whether
    // an amount was incidentally detected in them.
    const importable = items.filter(
      (i) => i.classification === "TRANSACTION" && i.detectedAmount !== null && i.type !== null
    );

    const rows = importable.map((item): Transaction => {
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
    if (rows.length > 0) {
      try {
        await appendSheetValues(GMAIL_IMPORT_RANGE, rows.map(transactionToRow));
        markImported(rows.map((r) => r.sourceMessageId!));
      } catch {
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
      transactionsImported: errors === 0 ? importable.length : 0,
      duplicates: 0, // cross-source dedup happens downstream via findCrossSourceDuplicates (project-spec-truth.md §"DEDUPLICATION")
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
