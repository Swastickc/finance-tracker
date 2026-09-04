"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw, Search } from "lucide-react";
import type { DryRunItem, ImportOutcome, ScanResult } from "@/lib/gmail/types";
import { scanGmailAction, dryRunGmailAction, importGmailAction } from "@/lib/gmail/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

const CONFIDENCE_TONE = { high: "success", medium: "warning", low: "danger" } as const;
const DRY_RUN_BATCH_SIZE = 20;

type Step = "idle" | "scanning" | "scanned" | "running-dry-run" | "dry-run" | "importing" | "imported";

export function GmailImportPanel() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<DryRunItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleScan() {
    setStep("scanning");
    setError(null);
    try {
      const result = await scanGmailAction();
      setScanResult(result);
      setStep("scanned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
      setStep("idle");
    }
  }

  async function handleDryRun() {
    if (!scanResult) return;
    setStep("running-dry-run");
    setError(null);
    try {
      const batch = scanResult.candidateMessageIds.slice(0, DRY_RUN_BATCH_SIZE);
      const result = await dryRunGmailAction(batch);
      setItems(result.items);
      setSelected(new Set(result.items.filter((i) => i.confidence !== "low").map((i) => i.messageId)));
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
        <Button onClick={handleScan} disabled={step === "scanning"} className="text-sm">
          <Search size={15} aria-hidden="true" />
          {step === "scanning" ? "Scanning…" : "Scan Gmail"}
        </Button>
        {scanResult && (
          <Button
            variant="secondary"
            onClick={handleDryRun}
            disabled={step === "running-dry-run" || step === "scanning"}
            className="text-sm"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {step === "running-dry-run" ? "Running dry run…" : "Run dry run"}
          </Button>
        )}
      </div>

      {scanResult && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Messages found</p>
            <p className="font-medium tabular-nums">{scanResult.messagesFound}</p>
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
                  disabled={item.detectedAmount === null}
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
                    <Badge tone={CONFIDENCE_TONE[item.confidence]}>{item.confidence} confidence</Badge>
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
