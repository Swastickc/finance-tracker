"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CategoryRule, Transaction } from "@/lib/types";
import type { ReviewItem } from "@/lib/review";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewItemCard } from "@/components/review/ReviewItemCard";
import { CreateRuleDialog, type NewRuleDraft } from "@/components/review/CreateRuleDialog";
import { TransactionDetailSheet } from "@/components/transactions/TransactionDetailSheet";

interface ReviewQueueViewProps {
  initialQueue: ReviewItem[];
  initialRules: CategoryRule[];
}

export function ReviewQueueView({ initialQueue, initialRules }: ReviewQueueViewProps) {
  const [queue, setQueue] = useState(initialQueue);
  const [, setRules] = useState(initialRules);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [ruleDraftFor, setRuleDraftFor] = useState<Transaction | null>(null);

  // Optimistic-only for now (matches prior behavior — no persistence backend
  // exists yet for review actions). A confirmed/ignored/edited item simply
  // leaves this page's local queue; it no longer has status "review" so it
  // won't reappear once the underlying data actually reflects the change.
  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((item) => item.transaction.id !== id));
  }

  function handleConfirm(id: string) {
    removeFromQueue(id);
  }

  function handleIgnore(id: string) {
    removeFromQueue(id);
  }

  function handleSave(updated: Transaction) {
    setQueue((prev) => prev.map((item) => (item.transaction.id === updated.id ? { ...item, transaction: updated } : item)));
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
    removeFromQueue(ruleDraftFor.id);
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
