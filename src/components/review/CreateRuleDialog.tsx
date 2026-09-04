"use client";

import { useEffect, useRef, useState } from "react";
import type { Category, Transaction } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface NewRuleDraft {
  pattern: string;
  merchant: string;
  category: Category;
}

interface CreateRuleDialogProps {
  transaction: Transaction | null;
  onClose: () => void;
  onCreate: (draft: NewRuleDraft) => void;
}

function guessPattern(t: Transaction) {
  const match = t.rawDescription.match(/[A-Z][A-Z0-9&.]{2,}(?:[ .][A-Z0-9&.]{2,})*/);
  return match?.[0] ?? t.merchant ?? "";
}

export function CreateRuleDialog({ transaction, onClose, onCreate }: CreateRuleDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (transaction && !dialog.open) dialog.showModal();
    if (!transaction && dialog.open) dialog.close();
  }, [transaction]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-0 text-foreground backdrop:bg-black/40 sm:w-full"
    >
      {transaction && (
        <RuleForm
          key={transaction.id}
          transaction={transaction}
          onCreate={onCreate}
          onCancel={() => dialogRef.current?.close()}
        />
      )}
    </dialog>
  );
}

function RuleForm({
  transaction,
  onCreate,
  onCancel,
}: {
  transaction: Transaction;
  onCreate: (draft: NewRuleDraft) => void;
  onCancel: () => void;
}) {
  const [pattern, setPattern] = useState(guessPattern(transaction));
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [category, setCategory] = useState<Category>(
    transaction.category === "Uncategorized" ? "Other" : transaction.category
  );
  const canSave = pattern.trim() !== "" && merchant.trim() !== "";

  return (
    <form method="dialog" className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="text-[17px] font-semibold">Create rule</p>
        <button type="submit" aria-label="Close" className="text-sm font-medium text-accent">
          Done
        </button>
      </div>

      <div className="space-y-5 px-5 py-4">
        <p className="text-sm text-muted">
          Future transactions matching this pattern will be categorized automatically.
        </p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Match pattern</span>
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="e.g. ZOMATO" maxLength={100} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Merchant name</span>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Zomato" maxLength={80} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] outline-none focus-visible:border-accent"
          >
            {CATEGORIES.filter((c) => c !== "Uncategorized").map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-3 border-t border-border px-5 py-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!canSave}
          onClick={() => onCreate({ pattern: pattern.trim(), merchant: merchant.trim(), category })}
        >
          Create rule
        </Button>
      </div>
    </form>
  );
}
