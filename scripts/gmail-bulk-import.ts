#!/usr/bin/env tsx
// Unattended, one-shot bulk historical Gmail import. Reuses the real,
// already-tested app modules (client/parse/sheets) via tsconfig path
// aliases so this can never drift from the logic the UI itself uses.
//
// Conservative by design (matches the UI's own default pre-selection):
// only classification === "TRANSACTION" with a detected amount, type, and
// confidence "high" or "medium" is auto-imported. Everything else (low
// confidence, NON_TRANSACTION, UNKNOWN, ambiguous) is left OUT of the sheet
// entirely and recorded in the summary file for manual review later —
// never guessed, never silently written as a transaction.
//
// Safe to re-run: skips any sourceMessageId already present in GmailImports.

import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

process.loadEnvFile?.(".env");

import { listMessageIds, getMessage } from "@/lib/gmail/client";
import { buildScanQuery } from "@/lib/gmail/known-senders";
import { parseEmail } from "@/lib/gmail/parse";
import { parseHeaderDate, parseHeaderTime } from "@/lib/gmail/providers/live-gmail-provider";
import { fetchSheetValues, appendSheetValues } from "@/lib/sheets/client";
import { transactionToRow, CANONICAL_HEADERS } from "@/lib/canonical/sheetSchema";
import type { Transaction } from "@/lib/types";

const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";
const MAX_CANDIDATES = 20000; // effectively "all" for a personal inbox
const CONCURRENCY = 1; // serial on purpose \u2014 concurrency 6 blew through Gmail's per-minute quota almost immediately
const MIN_REQUEST_INTERVAL_MS = 650; // \u2248 92 req/min sustained, conservatively under quota
const RATE_LIMIT_COOLDOWN_MS = 65_000; // Gmail's quota window is 1 minute; pad slightly
const D1_CHUNK = 300;
const FLUSH_THRESHOLD = 100; // append/sync D1 every N accepted or skipped items, so a mid-run crash loses little progress
const D1_DATABASE_NAME = "finance-tracker-gmail-scan-state";

// Shared across all concurrent workers so a 429/403 from ANY request pauses
// EVERY request, instead of each worker independently retrying into the same
// still-exhausted quota window (which is what caused repeated permanent
// failures the first time this ran at higher concurrency with per-call
// backoff only).
let cooldownUntil = 0;
let lastRequestAt = 0;

async function throttleGate(): Promise<void> {
  for (;;) {
    const now = Date.now();
    if (now < cooldownUntil) {
      await new Promise((r) => setTimeout(r, cooldownUntil - now));
      continue;
    }
    const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - now;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    lastRequestAt = Date.now();
    return;
  }
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("RATE_LIMIT_EXCEEDED") || message.includes("rateLimitExceeded") || message.includes("(429)");
}

function assertSafeMessageId(id: string): void {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Unexpected Gmail message id format, refusing to inline into SQL: ${id}`);
}

function runD1Sql(sql: string): void {
  // Invoking wrangler's actual JS entry via node.exe directly — avoids all
  // Windows shell/.cmd spawning quirks (npx/npx.cmd both proved unreliable:
  // ENOENT without shell:true, EINVAL even with the .cmd extension). Uses
  // --command (not --file): --file uploads through a different Cloudflare
  // endpoint that a corporate proxy/VPN can break with a cert mismatch,
  // while --command hits the plain D1 query API that works fine here. No
  // shell is involved, so the array-based args need no manual escaping.
  const wranglerBin = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  execFileSync(process.execPath, [wranglerBin, "d1", "execute", D1_DATABASE_NAME, "--remote", "--command", sql], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function upsertD1State(ids: string[], state: "imported" | "pending"): void {
  for (let i = 0; i < ids.length; i += D1_CHUNK) {
    const chunk = ids.slice(i, i + D1_CHUNK);
    if (chunk.length === 0) continue;
    chunk.forEach(assertSafeMessageId);
    const now = new Date().toISOString();
    const values = chunk
      .map((id) => (state === "imported" ? `('${id}', 'imported', '${now}')` : `('${id}', 'pending', NULL)`))
      .join(",");
    const sql =
      state === "imported"
        ? `INSERT INTO gmail_scan_state (message_id, state, imported_at) VALUES ${values} ON CONFLICT(message_id) DO UPDATE SET state = 'imported', imported_at = excluded.imported_at`
        : `INSERT INTO gmail_scan_state (message_id, state, claimed_at) VALUES ${values} ON CONFLICT(message_id) DO NOTHING`;
    runD1Sql(sql);
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 12): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await throttleGate();
    try {
      return await fn();
    } catch (err) {
      if (isRateLimitError(err)) {
        cooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        console.warn(`  [rate limited] pausing all requests ~${RATE_LIMIT_COOLDOWN_MS / 1000}s (attempt ${attempt}/${maxAttempts} for ${label})`);
        continue; // rate-limit retries don't count against the normal attempt budget as harshly, but still bounded by maxAttempts
      }
      if (attempt === maxAttempts) {
        console.error(`[FAILED after ${maxAttempts} attempts] ${label}:`, err instanceof Error ? err.message : err);
        return null;
      }
      const backoffMs = Math.min(10_000, 500 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  return null;
}

interface SkippedItem {
  messageId: string;
  classification: string;
  confidence: string;
  reason: string;
}

async function main() {
  mkdirSync("data", { recursive: true });

  console.log("[1/5] Reading existing GmailImports rows for dedup...");
  const existingRows = await fetchSheetValues(GMAIL_IMPORT_RANGE);
  const header = existingRows[0] ?? CANONICAL_HEADERS;
  const sourceIdCol = header.indexOf("sourceMessageId");
  const alreadyImported = new Set(
    existingRows.slice(1).map((r) => r[sourceIdCol]).filter((v): v is string => Boolean(v))
  );
  console.log(`  ${alreadyImported.size} messages already present in the sheet.`);

  console.log("[2/5] Listing Gmail candidate message IDs (this may take a bit for a large inbox)...");
  const allIds = await listMessageIds(buildScanQuery(), MAX_CANDIDATES);
  const toProcess = allIds.filter((id) => !alreadyImported.has(id));
  console.log(`  ${allIds.length} total candidates, ${toProcess.length} need processing.`);

  console.log(`[3/5] Fetching + classifying ${toProcess.length} messages (serial, throttled)...`);
  const accepted: Transaction[] = [];
  const skipped: SkippedItem[] = [];
  const allSkippedForSummary: SkippedItem[] = [];
  let importedSoFar = 0;
  let errors = 0;
  let done = 0;

  async function flushAccepted(): Promise<void> {
    if (accepted.length === 0) return;
    const batch = accepted.splice(0, accepted.length);
    console.log(`  flushing ${batch.length} accepted transactions to ${GMAIL_IMPORT_RANGE}...`);
    await appendSheetValues(GMAIL_IMPORT_RANGE, batch.map(transactionToRow));
    try {
      upsertD1State(batch.map((t) => t.sourceMessageId!), "imported");
    } catch (err) {
      console.error("  D1 sync failed for this batch (sheet write already succeeded):", err);
    }
    importedSoFar += batch.length;
    writeSummary(false);
  }

  async function flushSkipped(): Promise<void> {
    if (skipped.length === 0) return;
    const batch = skipped.splice(0, skipped.length);
    try {
      upsertD1State(batch.map((s) => s.messageId), "pending");
    } catch (err) {
      console.error("  D1 sync failed for skipped batch:", err);
    }
    allSkippedForSummary.push(...batch);
    writeSummary(false);
  }

  function writeSummary(finished: boolean): void {
    const summary = {
      finishedAt: finished ? new Date().toISOString() : null,
      inProgress: !finished,
      totalCandidatesFound: allIds.length,
      alreadyImportedBeforeThisRun: alreadyImported.size,
      processedThisRun: done,
      processedTotalThisRun: toProcess.length,
      importedThisRun: importedSoFar,
      skippedForManualReview: allSkippedForSummary.length,
      fetchErrors: errors,
      skippedDetails: allSkippedForSummary.slice(0, 1000),
    };
    writeFileSync("data/gmail-bulk-import-summary.json", JSON.stringify(summary, null, 2));
  }

  await mapWithConcurrency(toProcess, CONCURRENCY, async (id) => {
    const msg = await withRetry(() => getMessage(id), `getMessage(${id})`);
    done++;
    if (done % 200 === 0 || done === toProcess.length) {
      console.log(`  ...${done}/${toProcess.length} (${accepted.length + importedSoFar} accepted so far)`);
    }
    if (!msg) {
      errors++;
      return;
    }

    const parsed = parseEmail(msg.from, msg.subject, msg.body);
    const isAutoImportable =
      parsed.classification === "TRANSACTION" &&
      parsed.detectedAmount !== null &&
      parsed.type !== null &&
      parsed.confidence !== "low";

    if (!isAutoImportable) {
      skipped.push({
        messageId: id,
        classification: parsed.classification,
        confidence: parsed.confidence,
        reason: parsed.classificationNote,
      });
      if (skipped.length >= FLUSH_THRESHOLD) await flushSkipped();
      return;
    }

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
    if (accepted.length >= FLUSH_THRESHOLD) await flushAccepted();
  });

  await flushAccepted();
  await flushSkipped();

  writeSummary(true);
  console.log("\nDone. Summary written to data/gmail-bulk-import-summary.json");
  console.log(
    `Imported ${importedSoFar} new transactions. ${allSkippedForSummary.length} messages need manual review (low-confidence/ambiguous — never auto-imported). ${errors} fetch errors.`
  );
}

main().catch((err) => {
  console.error("Bulk import crashed:", err);
  process.exit(1);
});
