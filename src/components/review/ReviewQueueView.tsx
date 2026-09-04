"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CategoryRule, Transaction } from "@/lib/types";
import { buildReviewQueue } from "@/lib/review";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewItemCard } from "@/components/review/ReviewItemCard";
import { CreateRuleDialog, type NewRuleDraft } from "@/components/review/CreateRuleDialog";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";

interface ReviewQueueViewProps {
  initialTransactions: Transaction[];
  initialRules: CategoryRule[];
}

export function ReviewQueueView({ initialTransactions, initialRules }: ReviewQueueViewProps) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [, setRules] = useState(initialRules);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [ruleDraftFor, setRuleDraftFor] = useState<Transaction | null>(null);

  const queue = useMemo(() => buildReviewQueue(transactions), [transactions]);

  function updateTransaction(id: string, patch: Partial<Transaction>) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function handleConfirm(id: string) {
    updateTransaction(id, { status: "confirmed" });
  }

  function handleIgnore(id: string) {
    updateTransaction(id, { status: "ignored" });
  }

  function handleSave(updated: Transaction) {
    setTransactions((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setEditing(null);
  }

  function handleCreateRule(draft: NewRuleDraft) {
    if (!ruleDraftFor) return;
    const now = new Date().toISOString();
    const rule: CategoryRule = {
      ruleId: `r-${Date.now()}`,
      pattern: draft.pattern,
      merchant: draft.merchant,
      category: draft.category,
      subcategory: null,
      priority: 5,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };
    setRules((prev) => [rule, ...prev]);
    updateTransaction(ruleDraftFor.id, {
      merchant: draft.merchant,
      category: draft.category,
      status: "confirmed",
      ruleId: rule.ruleId,
    });
    setRuleDraftFor(null);
  }

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<CheckCircle2 size={28} />}
        title="Nothing to review"
        description="Unknown merchants, low-confidence imports, and possible duplicates will show up here for quick confirmation."
      />
    );
  }

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <ReviewItemCard
          key={item.transaction.id}
          item={item}
          onConfirm={() => handleConfirm(item.transaction.id)}
          onEdit={() => setEditing(item.transaction)}
          onCreateRule={() => setRuleDraftFor(item.transaction)}
          onIgnore={() => handleIgnore(item.transaction.id)}
        />
      ))}

      <TransactionDetailSheet transaction={editing} onClose={() => setEditing(null)} onSave={handleSave} />
      <CreateRuleDialog transaction={ruleDraftFor} onClose={() => setRuleDraftFor(null)} onCreate={handleCreateRule} />
    </div>
  );
}
