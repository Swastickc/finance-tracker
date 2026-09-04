import { buildScanQuery } from "@/lib/gmail/known-senders";
import { getMessage, getMessageMetadata, listMessageIds } from "@/lib/gmail/client";
import { parseEmail } from "@/lib/gmail/parse";
import { appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow } from "@/lib/gmail/sheetSchema";
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

    return {
      scannedAt: new Date().toISOString(),
      messagesFound: ids.length,
      candidateSenders: [...bySender.entries()]
        .map(([sender, count]) => ({ sender, count }))
        .sort((a, b) => b.count - a.count),
      dateRangeStart: earliest,
      dateRangeEnd: latest,
      candidateMessageIds: ids,
    };
  }

  async dryRun(messageIds: string[]): Promise<DryRunResult> {
    const messages = await Promise.all(messageIds.map((id) => getMessage(id)));
    const items: DryRunItem[] = messages.map((m) => {
      const parsed = parseEmail(m.from, m.subject, m.body);
      return {
        messageId: m.id,
        sender: m.from,
        subject: m.subject,
        date: m.date,
        detectedAmount: parsed.detectedAmount,
        merchant: parsed.merchant,
        type: parsed.type,
        category: parsed.category,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
      };
    });
    return { runAt: new Date().toISOString(), items };
  }

  async importItems(items: DryRunItem[]): Promise<ImportOutcome> {
    const startedAt = new Date().toISOString();
    const importable = items.filter((i) => i.detectedAmount !== null && i.type !== null);

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
        source: "gmail",
        sourceMessageId: item.messageId,
        // Always "review": this is a historical, unverified import (PROJECT_SPEC.md §20).
        status: "review",
        confidence: item.confidence === "high" ? 0.85 : item.confidence === "medium" ? 0.65 : 0.4,
        isRecurring: false,
        ruleId: null,
        createdAt: now,
        updatedAt: now,
      };
    });

    let errors = 0;
    if (rows.length > 0) {
      try {
        await appendSheetValues(GMAIL_IMPORT_RANGE, rows.map(transactionToRow));
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
      duplicates: 0, // dedup happens downstream via the Review queue's fingerprint match (PROJECT_SPEC.md §6)
      errors,
      status: errors === 0 ? "completed" : "failed",
    };
  }
}

function parseHeaderDate(rfc2822: string): string {
  const date = new Date(rfc2822);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
}

function parseHeaderTime(rfc2822: string): string | null {
  const date = new Date(rfc2822);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(11, 16);
}
