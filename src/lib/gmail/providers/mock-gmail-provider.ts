import { parseEmail } from "@/lib/gmail/parse";
import { addMockImportRecord } from "@/lib/mock-data";
import type { DryRunItem, DryRunResult, ImportOutcome, ScanResult } from "@/lib/gmail/types";
import type { GmailImporter } from "@/lib/gmail/providers/types";

// Illustrative fixtures only — NOT claims about real bank/merchant email
// formats (PROJECT_SPEC.md §7 says to inspect real samples before trusting
// a parser). These exist to exercise parseEmail() end-to-end in the UI
// without live Gmail credentials.
const FIXTURE_EMAILS = [
  {
    id: "fixture-msg-1",
    from: "Amazon.in <auto-confirm@amazon.in>",
    subject: "Your Amazon.in order has been shipped",
    date: "Tue, 12 Aug 2025 14:03:00 +0530",
    body: "Hi, your card was debited Rs. 2,499.00 for order #402-1234567. Total amount charged: Rs. 2,499.00.",
  },
  {
    id: "fixture-msg-2",
    from: "Zomato <noreply@zomato.com>",
    subject: "Order confirmed — Zomato",
    date: "Wed, 13 Aug 2025 20:15:00 +0530",
    body: "You spent Rs. 640 on your Zomato order. Enjoy your meal!",
  },
  {
    id: "fixture-msg-3",
    from: "Prime Video <no-reply@primevideo.com>",
    subject: "Your Prime Video payment receipt",
    date: "Thu, 01 Aug 2025 09:00:00 +0530",
    body: "Payment received. Rs. 149.00 was debited for your monthly Prime Video subscription.",
  },
  {
    id: "fixture-msg-4",
    from: "unknownsender@example.com",
    subject: "Payment notification",
    date: "Fri, 02 Aug 2025 11:30:00 +0530",
    body: "This is a notification email with no clear amount or merchant reference.",
  },
];

export class MockGmailImporter implements GmailImporter {
  async scan(): Promise<ScanResult> {
    const bySender = new Map<string, number>();
    for (const email of FIXTURE_EMAILS) {
      const sender = email.from.split("<")[0].trim();
      bySender.set(sender, (bySender.get(sender) ?? 0) + 1);
    }

    return {
      scannedAt: new Date().toISOString(),
      messagesFound: FIXTURE_EMAILS.length,
      candidateSenders: [...bySender.entries()].map(([sender, count]) => ({ sender, count })),
      dateRangeStart: "2025-08-01",
      dateRangeEnd: "2025-08-13",
      candidateMessageIds: FIXTURE_EMAILS.map((e) => e.id),
      // Mock has no real incremental tracking — every scan reports all fixtures as new.
      newMessageIds: FIXTURE_EMAILS.map((e) => e.id),
    };
  }

  async dryRun(messageIds: string[]): Promise<DryRunResult> {
    const items: DryRunItem[] = FIXTURE_EMAILS.filter((e) => messageIds.includes(e.id)).map((email) => {
      const parsed = parseEmail(email.from, email.subject, email.body);
      return {
        messageId: email.id,
        sender: email.from,
        subject: email.subject,
        date: email.date,
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
    const importable = items.filter((i) => i.detectedAmount !== null);

    const outcome: ImportOutcome = {
      importId: `imp-gmail-${Date.now()}`,
      source: "gmail",
      startedAt,
      completedAt: new Date().toISOString(),
      messagesScanned: FIXTURE_EMAILS.length,
      transactionsDetected: importable.length,
      transactionsImported: importable.length,
      duplicates: 0,
      errors: items.length - importable.length,
      status: "completed",
    };

    addMockImportRecord({
      importId: outcome.importId,
      source: "gmail",
      startedAt: outcome.startedAt,
      completedAt: outcome.completedAt,
      messagesScanned: outcome.messagesScanned,
      transactionsDetected: outcome.transactionsDetected,
      transactionsImported: outcome.transactionsImported,
      duplicates: outcome.duplicates,
      errors: outcome.errors,
      status: "completed",
    });

    return outcome;
  }
}
