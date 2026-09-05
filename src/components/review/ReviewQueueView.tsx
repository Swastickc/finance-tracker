"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { CategoryRule, Transaction } from "@/lib/types";
import type { ReviewItem } from "@/lib/review";
import { createCategoryRuleAction } from "@/lib/data/ruleActions";
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
    const pendingId = ruleDraftFor.id;
    setRuleDraftFor(null);
    createCategoryRuleAction(draft)
      .then((rule) => {
        setRules((prev) => [rule, ...prev]);
        removeFromQueue(pendingId);
      })
      .catch((err) => {
        console.error("Failed to create rule:", err);
      });
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
