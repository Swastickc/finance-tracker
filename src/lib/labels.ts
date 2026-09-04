import type { TransactionSource, TransactionStatus, TransactionType } from "@/lib/types";

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
