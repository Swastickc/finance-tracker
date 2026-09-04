"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Upload } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { dryRunBankStatementAction, importBankStatementAction, type BankDryRunResult } from "@/lib/bank/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";

type Step = "idle" | "parsing" | "dry-run" | "importing" | "imported";

export function BankImportPanel() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<BankDryRunResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ imported: number; ignored: number } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep("parsing");
    setError(null);
    setOutcome(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const dryRun = await dryRunBankStatementAction(formData);
      setResult(dryRun);
      setSelected(new Set(dryRun.transactions.filter((t) => t.status !== "ignored").map((t) => t.id)));
      setStep("dry-run");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse the statement.");
      setStep("idle");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleImport() {
    if (!result) return;
    setStep("importing");
    setError(null);
    try {
      const chosen = result.transactions.filter((t) => selected.has(t.id));
      const outcome = await importBankStatementAction(chosen);
      setOutcome(outcome);
      setStep("imported");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStep("dry-run");
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
        <div>
          <p className="text-[15px] font-semibold">Bank statement import</p>
          <p className="mt-1 text-sm text-muted">
            Upload a bank statement export (.xls/.xlsx). Rows are parsed and reconciled against
            previous imports before anything is written — nothing is saved until you confirm.
          </p>
        </div>
      </div>

      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4">
        <input ref={fileInputRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileChange} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={step === "parsing"} className="text-sm">
          <Upload size={15} aria-hidden="true" />
          {step === "parsing" ? "Parsing…" : "Upload statement"}
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted">Rows parsed</p>
              <p className="font-medium tabular-nums">{result.parsedCount}</p>
            </div>
            <div>
              <p className="text-muted">Exact duplicates</p>
              <p className="font-medium tabular-nums">{result.exactDuplicateCount}</p>
            </div>
            <div>
              <p className="text-muted">Possible duplicates</p>
              <p className="font-medium tabular-nums">{result.possibleDuplicates.length}</p>
            </div>
          </div>

          {result.parseWarnings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.parseWarnings.slice(0, 5).map((w) => (
                <Badge key={w} tone="neutral">
                  {w}
                </Badge>
              ))}
            </div>
          )}

          {result.transactions.length > 0 && (
            <div className="divide-y divide-border rounded-xl border border-border">
              {result.transactions.slice(0, 30).map((t: Transaction) => (
                <label key={t.id} className="flex items-start gap-3 px-3.5 py-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 flex-shrink-0"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    disabled={t.status === "ignored"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{t.transactionDate}</p>
                      <p className="flex-shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(t.amount)}</p>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted">{t.rawDescription}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge tone="neutral">{t.type}</Badge>
                      {t.status === "ignored" && <Badge tone="warning">Duplicate — excluded</Badge>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <Button onClick={handleImport} disabled={step === "importing" || selected.size === 0} className="text-sm">
            {step === "importing" ? "Importing…" : `Import ${selected.size} selected`}
          </Button>
        </div>
      )}

      {outcome && (
        <p className="mt-4 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
          Imported {outcome.imported} transactions{outcome.ignored > 0 ? `, ${outcome.ignored} excluded as duplicates` : ""}.
        </p>
      )}
    </Card>
  );
}
