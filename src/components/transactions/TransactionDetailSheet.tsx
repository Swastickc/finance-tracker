"use client";

import { useEffect, useRef, useState } from "react";
import type { Transaction } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { SOURCE_LABEL, STATUS_LABEL, TYPE_LABEL } from "@/lib/labels";
import { formatCurrency, formatRelativeDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
  onSave: (updated: Transaction) => void;
}

export function TransactionDetailSheet({ transaction, onClose, onSave }: TransactionDetailSheetProps) {
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
        <DialogContent
          key={transaction.id}
          transaction={transaction}
          onSave={onSave}
          onCancel={() => dialogRef.current?.close()}
        />
      )}
    </dialog>
  );
}

function DialogContent({
  transaction,
  onSave,
  onCancel,
}: {
  transaction: Transaction;
  onSave: (updated: Transaction) => void;
  onCancel: () => void;
}) {
  const [merchant, setMerchant] = useState(transaction.merchant ?? "");
  const [category, setCategory] = useState<Transaction["category"]>(transaction.category);
  const isEdited = merchant !== (transaction.merchant ?? "") || category !== transaction.category;

  return (
    <form method="dialog" className="flex max-h-[85vh] flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="text-[17px] font-semibold">Transaction</p>
        <button type="submit" aria-label="Close" className="text-sm font-medium text-accent">
          Done
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCurrency(transaction.amount, transaction.currency)}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {formatRelativeDate(transaction.transactionDate, transaction.transactionTime)} ·{" "}
            {TYPE_LABEL[transaction.type]}
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Merchant</span>
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Unknown merchant" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Transaction["category"])}
            className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] outline-none focus-visible:border-accent"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div>
          <p className="mb-1.5 text-sm font-medium text-muted">Original message</p>
          <p className="rounded-xl bg-surface-secondary px-3.5 py-3 font-mono text-[13px] leading-5 text-muted">
            {transaction.rawDescription}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted">Source</dt>
            <dd className="font-medium">{SOURCE_LABEL[transaction.source]}</dd>
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="font-medium">
              <Badge tone={transaction.status === "review" ? "warning" : "neutral"}>
                {STATUS_LABEL[transaction.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted">Account</dt>
            <dd className="font-medium">{transaction.account ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted">Payment method</dt>
            <dd className="font-medium">{transaction.paymentMethod ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="flex gap-3 border-t border-border px-5 py-4">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!isEdited}
          onClick={() => onSave({ ...transaction, merchant: merchant.trim() || null, category, status: "confirmed" })}
        >
          Save
        </Button>
      </div>
    </form>
  );
}

