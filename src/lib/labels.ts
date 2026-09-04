import type { TransactionSource, TransactionStatus, TransactionType } from "@/lib/types";
import type { ReviewReason } from "@/lib/review";

export const SOURCE_LABEL: Record<TransactionSource, string> = {
  sms: "SMS",
  gmail: "Gmail",
  manual: "Manual",
  import: "Import",
};

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  confirmed: "Confirmed",
  review: "Needs review",
  ignored: "Ignored",
};

export const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  refund: "Refund",
  transfer: "Transfer",
};

export const REVIEW_REASON_LABEL: Record<ReviewReason, string> = {
  unknown_merchant: "Unknown merchant",
  uncategorized: "Uncategorized",
  low_confidence: "Low-confidence parsing",
  possible_duplicate: "Possible duplicate",
};

