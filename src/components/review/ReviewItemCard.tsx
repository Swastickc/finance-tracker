import { Check, EyeOff, Pencil, Sparkles } from "lucide-react";
import type { ReviewItem } from "@/lib/review";
import { REVIEW_REASON_LABEL } from "@/lib/labels";
import { formatRelativeDate, formatSignedCurrency } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface ReviewItemCardProps {
  item: ReviewItem;
  onConfirm: () => void;
  onEdit: () => void;
  onCreateRule: () => void;
  onIgnore: () => void;
}

export function ReviewItemCard({ item, onConfirm, onEdit, onCreateRule, onIgnore }: ReviewItemCardProps) {
  const { transaction: t, reasons, duplicateOf } = item;
  const canConfirm = !reasons.includes("unknown_merchant") && !reasons.includes("uncategorized");

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{t.merchant ?? "Unknown merchant"}</p>
          <p className="mt-0.5 text-sm text-muted">
            {formatRelativeDate(t.transactionDate, t.transactionTime)} · {t.category}
          </p>
        </div>
        <p className="flex-shrink-0 text-[15px] font-semibold tabular-nums">
          {formatSignedCurrency(t.amount, t.type, t.currency)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <Badge key={r} tone="warning">
            {REVIEW_REASON_LABEL[r]}
          </Badge>
        ))}
      </div>

      {duplicateOf && (
        <p className="mt-2.5 rounded-lg bg-surface-secondary px-3 py-2 text-sm text-muted">
          Looks like {duplicateOf.merchant} on {formatRelativeDate(duplicateOf.transactionDate, duplicateOf.transactionTime)} via{" "}
          {duplicateOf.source.toUpperCase()}
        </p>
      )}

      <p className="mt-2.5 truncate text-xs text-muted">{t.rawDescription}</p>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {canConfirm && (
          <Button className="text-sm" onClick={onConfirm}>
            <Check size={15} aria-hidden="true" /> Confirm
          </Button>
        )}
        <Button variant="secondary" className="text-sm" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" /> Edit
        </Button>
        <Button variant="secondary" className="text-sm" onClick={onCreateRule}>
          <Sparkles size={15} aria-hidden="true" /> Create rule
        </Button>
        <Button variant="ghost" className="text-sm text-muted" onClick={onIgnore}>
          <EyeOff size={15} aria-hidden="true" /> Ignore
        </Button>
      </div>
    </Card>
  );
}
