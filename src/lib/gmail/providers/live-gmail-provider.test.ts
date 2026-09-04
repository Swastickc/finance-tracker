import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveGmailImporter } from "@/lib/gmail/providers/live-gmail-provider";
import { getScanStateStore, resetScanStateStoreForTests } from "@/lib/gmail/scanState";
import type { DryRunItem } from "@/lib/gmail/types";

vi.mock("@/lib/sheets/client", () => ({
  appendSheetValues: vi.fn(),
}));

import { appendSheetValues } from "@/lib/sheets/client";

function makeItem(overrides: Partial<DryRunItem> = {}): DryRunItem {
  return {
    messageId: "msg-1",
    sender: "Amazon <auto-confirm@amazon.in>",
    subject: "Order shipped",
    date: "Tue, 12 Aug 2025 14:03:00 +0530",
    classification: "TRANSACTION",
    nonTransactionReason: null,
    detectedAmount: 500,
    merchant: "Amazon",
    type: "expense",
    category: "Shopping",
    confidence: "high",
    classificationNote: "test",
    possibleDuplicateOfMessageId: null,
    warnings: [],
    ...overrides,
  };
}

describe("LiveGmailImporter.importItems (claim-before-write)", () => {
  beforeEach(() => {
    resetScanStateStoreForTests();
    vi.mocked(appendSheetValues).mockReset();
  });

  it("claims before writing, appends only claimed items, and finalizes the claim", async () => {
    vi.mocked(appendSheetValues).mockResolvedValue(undefined);
    const importer = new LiveGmailImporter();
    const outcome = await importer.importItems([makeItem()]);

    expect(appendSheetValues).toHaveBeenCalledTimes(1);
    const [, rows] = vi.mocked(appendSheetValues).mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(outcome.transactionsImported).toBe(1);
    expect(outcome.status).toBe("completed");

    const store = await getScanStateStore();
    expect(await store.getMessageState("msg-1")).toBe("imported");
  });

  it("importItems() never calls Sheets for an already-imported message", async () => {
    vi.mocked(appendSheetValues).mockResolvedValue(undefined);
    const importer = new LiveGmailImporter();
    await importer.importItems([makeItem()]);
    vi.mocked(appendSheetValues).mockClear();

    const outcome = await importer.importItems([makeItem()]);
    expect(appendSheetValues).not.toHaveBeenCalled();
    expect(outcome.transactionsImported).toBe(0);
    expect(outcome.duplicates).toBe(1);
  });

  it("importItems() never calls Sheets for an already-importing message (simulated concurrent request)", async () => {
    const store = await getScanStateStore();
    await store.tryClaim("msg-1"); // simulates another in-flight request that already claimed it

    const importer = new LiveGmailImporter();
    const outcome = await importer.importItems([makeItem()]);
    expect(appendSheetValues).not.toHaveBeenCalled();
    expect(outcome.duplicates).toBe(1);
  });

  it("duplicate message IDs in the same import request are handled safely — claimed and appended only once", async () => {
    vi.mocked(appendSheetValues).mockResolvedValue(undefined);
    const importer = new LiveGmailImporter();
    const outcome = await importer.importItems([makeItem(), makeItem()]);

    expect(appendSheetValues).toHaveBeenCalledTimes(1);
    const [, rows] = vi.mocked(appendSheetValues).mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(outcome.transactionsImported).toBe(1);
    expect(outcome.duplicates).toBe(1);
  });

  it("a Sheets failure does not mark the message imported, and leaves it unclaimable rather than released back to pending", async () => {
    vi.mocked(appendSheetValues).mockRejectedValue(new Error("network error"));
    const importer = new LiveGmailImporter();
    const outcome = await importer.importItems([makeItem()]);

    expect(outcome.status).toBe("failed");
    expect(outcome.transactionsImported).toBe(0);
    const store = await getScanStateStore();
    expect(await store.getMessageState("msg-1")).toBe("importing");
    // Retrying immediately must not re-append — it's still claimed ("importing").
    vi.mocked(appendSheetValues).mockResolvedValue(undefined);
    const retryOutcome = await importer.importItems([makeItem()]);
    expect(appendSheetValues).toHaveBeenCalledTimes(1); // still just the original (failed) attempt
    expect(retryOutcome.duplicates).toBe(1);
  });
});
