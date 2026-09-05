"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw, Search, Zap } from "lucide-react";
import type { DryRunItem, ImportOutcome, ScanResult } from "@/lib/gmail/types";
import { scanGmailAction, dryRunGmailAction, importGmailAction } from "@/lib/gmail/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

const CONFIDENCE_TONE = { high: "success", medium: "warning", low: "danger" } as const;
// Matches the server's MAX_BATCH_SIZE (src/lib/gmail/actions.ts) so a batch
// is never silently truncated.
const DRY_RUN_BATCH_SIZE = 50;
// Server-side rate limit is 10 actions/60s per action name (scan/dry-run/import
// each counted separately — see assertNotRateLimited in src/lib/gmail/actions.ts).
// One dry-run + one import per iteration, paced above 6s apart, stays safely
// under that limit for both action types at once.
const PROCESS_ALL_DELAY_MS = 6500;

type Step = "idle" | "scanning" | "scanned" | "running-dry-run" | "dry-run" | "importing" | "imported" | "processing-all";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GmailImportPanel() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<DryRunItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Advances through candidateMessageIds across repeated "Run dry run" clicks
  // so a large scan (e.g. thousands of candidates) can be worked through in
  // batches instead of always re-processing the first DRY_RUN_BATCH_SIZE.
  const [dryRunOffset, setDryRunOffset] = useState(0);
  const [processAllProgress, setProcessAllProgress] = useState<{ imported: number; skippedLowConfidence: number } | null>(
    null
  );
  const cancelProcessAllRef = useRef(false);

  async function handleScan() {
    setStep("scanning");
    setError(null);
    try {
      const result = await scanGmailAction();
      setScanResult(result);
      setDryRunOffset(0);
      setStep("scanned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
      setStep("idle");
    }
  }

  async function handleDryRun() {
    if (!scanResult) return;
    const batch = scanResult.candidateMessageIds.slice(dryRunOffset, dryRunOffset + DRY_RUN_BATCH_SIZE);
    if (batch.length === 0) return;
    setStep("running-dry-run");
    setError(null);
    try {
      const result = await dryRunGmailAction(batch);
      setItems(result.items);
      setSelected(
        new Set(
          result.items.filter((i) => i.classification === "TRANSACTION" && i.confidence !== "low").map((i) => i.messageId)
        )
      );
      setDryRunOffset((prev) => prev + batch.length);
      setStep("dry-run");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dry run failed.");
      setStep("scanned");
    }
  }

  async function handleImport() {
    setStep("importing");
    setError(null);
    try {
      const chosen = items.filter((i) => selected.has(i.messageId));
      const result = await importGmailAction(chosen);
      setOutcome(result);
      setStep("imported");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStep("dry-run");
    }
  }

  function toggle(messageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  /**
   * Automates the manual "dry run -> select safe candidates -> import" loop
   * across every remaining candidate. Never selects NON_TRANSACTION/UNKNOWN
   * or low-confidence items (same rule as the default manual selection) —
   * those are left for manual review in the dry-run list or the Review page,
   * never auto-imported. Paced to respect the server's per-action rate limit.
   */
  async function handleProcessAll() {
    if (!scanResult) return;
    cancelProcessAllRef.current = false;
    setStep("processing-all");
    setError(null);
    setProcessAllProgress({ imported: 0, skippedLowConfidence: 0 });

    let offset = dryRunOffset;
    let totalImported = 0;
    let totalSkippedLowConfidence = 0;

    try {
      while (offset < scanResult.candidateMessageIds.length) {
        if (cancelProcessAllRef.current) break;

        const batch = scanResult.candidateMessageIds.slice(offset, offset + DRY_RUN_BATCH_SIZE);
        const dryRunResult = await dryRunGmailAction(batch);
        setItems(dryRunResult.items);

        const safeIds = dryRunResult.items
          .filter((i) => i.classification === "TRANSACTION" && i.confidence !== "low" && i.detectedAmount !== null)
          .map((i) => i.messageId);
        totalSkippedLowConfidence += dryRunResult.items.filter((i) => i.classification === "TRANSACTION" && i.confidence === "low").length;
        setSelected(new Set(safeIds));

        if (safeIds.length > 0) {
          const chosen = dryRunResult.items.filter((i) => safeIds.includes(i.messageId));
          const importResult = await importGmailAction(chosen);
          totalImported += importResult.transactionsImported;
        }

        offset += batch.length;
        setDryRunOffset(offset);
        setProcessAllProgress({ imported: totalImported, skippedLowConfidence: totalSkippedLowConfidence });

        if (offset < scanResult.candidateMessageIds.length && !cancelProcessAllRef.current) {
          await sleep(PROCESS_ALL_DELAY_MS);
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Process all failed — you can resume from where it stopped.");
    } finally {
      setStep("scanned");
    }
  }

  function handleCancelProcessAll() {
    cancelProcessAllRef.current = true;
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
        <div>
          <p className="text-[15px] font-semibold">Gmail import</p>
          <p className="mt-1 text-sm text-muted">
            Scan for candidate transaction emails, preview what would be imported, then import only
            what you approve. Nothing is written until you confirm.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handleScan} disabled={step === "scanning" || step === "processing-all"} className="text-sm">
          <Search size={15} aria-hidden="true" />
          {step === "scanning" ? "Scanning…" : "Scan Gmail"}
        </Button>
        {scanResult && (
          <Button
            variant="secondary"
            onClick={handleDryRun}
            disabled={
              step === "running-dry-run" ||
              step === "scanning" ||
              step === "processing-all" ||
              dryRunOffset >= scanResult.candidateMessageIds.length
            }
            className="text-sm"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {step === "running-dry-run"
              ? "Running dry run…"
              : dryRunOffset >= scanResult.candidateMessageIds.length
                ? "All candidates dry-run"
                : `Run dry run (${dryRunOffset}/${scanResult.candidateMessageIds.length})`}
          </Button>
        )}
        {scanResult && dryRunOffset < scanResult.candidateMessageIds.length && step !== "processing-all" && (
          <Button
            variant="secondary"
            onClick={handleProcessAll}
            disabled={step === "scanning" || step === "running-dry-run" || step === "importing"}
            className="text-sm"
          >
            <Zap size={15} aria-hidden="true" />
            Process all remaining ({scanResult.candidateMessageIds.length - dryRunOffset})
          </Button>
        )}
        {step === "processing-all" && (
          <Button variant="secondary" onClick={handleCancelProcessAll} className="text-sm">
            Stop after this batch
          </Button>
        )}
      </div>

      {step === "processing-all" && scanResult && processAllProgress && (
        <p className="mt-3 rounded-lg bg-accent/10 px-3 py-2 text-sm">
          Processing… {dryRunOffset}/{scanResult.candidateMessageIds.length} scanned, {processAllProgress.imported} imported,{" "}
          {processAllProgress.skippedLowConfidence} skipped (low confidence, left for manual review).
        </p>
      )}
      {step !== "processing-all" && processAllProgress && (
        <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Process all finished: {processAllProgress.imported} imported, {processAllProgress.skippedLowConfidence} left for
          manual review (low confidence).
        </p>
      )}

      {scanResult && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Messages found</p>
            <p className="font-medium tabular-nums">
              {scanResult.messagesFound} <span className="text-muted">({scanResult.newMessageIds.length} new)</span>
            </p>
          </div>
          <div>
            <p className="text-muted">Date range</p>
            <p className="font-medium">
              {scanResult.dateRangeStart ?? "—"} → {scanResult.dateRangeEnd ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-muted">Top senders</p>
            <p className="font-medium">{scanResult.candidateSenders.slice(0, 2).map((s) => s.sender).join(", ") || "—"}</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium text-muted">Dry run preview — {items.length} messages</p>
          <div className="divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <label key={item.messageId} className="flex items-start gap-3 px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 flex-shrink-0"
                  checked={selected.has(item.messageId)}
                  onChange={() => toggle(item.messageId)}
                  disabled={item.classification !== "TRANSACTION" || item.detectedAmount === null}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{item.merchant ?? item.sender}</p>
                    <p className="flex-shrink-0 text-sm font-semibold tabular-nums">
                      {item.detectedAmount !== null ? formatCurrency(item.detectedAmount) : "—"}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">{item.subject}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.classification === "TRANSACTION" ? (
                      <Badge tone={CONFIDENCE_TONE[item.confidence]}>{item.confidence} confidence</Badge>
                    ) : (
                      <Badge tone="neutral">{item.classification === "NON_TRANSACTION" ? "Not a transaction" : "Ambiguous"}</Badge>
                    )}
                    {item.warnings.map((w) => (
                      <Badge key={w} tone="neutral">
                        {w}
                      </Badge>
                    ))}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <Button onClick={handleImport} disabled={step === "importing" || selected.size === 0} className="text-sm">
            {step === "importing" ? "Importing…" : `Import ${selected.size} selected`}
          </Button>
        </div>
      )}

      {outcome && (
        <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Imported {outcome.transactionsImported} of {outcome.transactionsDetected} detected transactions.
        </p>
      )}
    </Card>
  );
}
