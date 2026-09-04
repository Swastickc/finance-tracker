import type { TransactionType } from "@/lib/types";

export type SmsClassification = "TRANSACTION" | "NON_TRANSACTION" | "UNKNOWN";

export interface SmsClassifyResult {
  classification: SmsClassification;
  type: TransactionType | null; // only set when classification === "TRANSACTION"
  amount: number | null;
  /** Best-effort raw payee/merchant text extracted from the message — NOT normalized. */
  payee: string | null;
  accountLast4: string | null;
  confidence: number;
  /** Human-readable — feeds Transaction.classificationNote. */
  reason: string;
  warnings: string[];
}

const AMOUNT_PATTERN = /(?:rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i;

function extractAmount(text: string): number | null {
  const match = text.match(AMOUNT_PATTERN);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function extractAccountLast4(text: string): string | null {
  const match = text.match(/(?:card|a\/?c(?:count)?|acct)\D{0,15}?(\d{4})\b/i);
  return match?.[1] ?? null;
}

/** "...debited...; SYED JUNAID AHM credited." -> payee the money went to. */
function extractDebitPayee(text: string): string | null {
  const match = text.match(/;\s*([A-Z][A-Z .]{2,40}?)\s+credited/i);
  return match?.[1]?.trim() ?? null;
}

/** "...credited with Rs 250.00 on 04-Sep-26 from TIYASHA MISRA." -> sender. */
function extractCreditPayee(text: string): string | null {
  const match = text.match(/\bfrom\s+([A-Z][A-Z .]{2,40}?)(?:\.\s|\.$|\s+UPI|$)/i);
  return match?.[1]?.trim() ?? null;
}

/** "...On HDFC Bank Card 8721 At AmazonSellerServices On 2026-09-04..." -> "AmazonSellerServices". */
function extractCardPurchasePayee(text: string): string | null {
  const match = text.match(/\bAt\s+([A-Za-z0-9&._-]{2,40}?)\s+On\b/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Deterministic semantic classifier for banking SMS (project-spec-truth.md
 * §"EXISTING SMS -> GOOGLE SHEETS"). Sender IDs (AD-ICICIT-S, AX-HDFCBK-S,
 * etc.) are deliberately NOT used as signal — message content only.
 *
 * Order matters: more specific non-transaction patterns (OTP, due reminders)
 * are checked before generic transaction verbs, since a due-reminder or OTP
 * message can still contain the words "credit card" / an amount without
 * being an actual transaction.
 */
export function classifySmsText(text: string): SmsClassifyResult {
  const warnings: string[] = [];
  const amount = extractAmount(text);
  const accountLast4 = extractAccountLast4(text);

  // --- NON_TRANSACTION: OTP messages are never transactions themselves ---
  if (/\botp\b/i.test(text) || /\bone[\s-]?time\s+password\b/i.test(text)) {
    return {
      classification: "NON_TRANSACTION",
      type: null,
      amount,
      payee: null,
      accountLast4,
      confidence: 0.95,
      reason: "sms-classifier: matched OTP pattern — not a transaction",
      warnings,
    };
  }

  // --- NON_TRANSACTION: payment-due reminders (no actual movement of money) ---
  if (/\b(is\s+due|payment\s+due|due\s+on|due\s+date)\b/i.test(text) && !/\b(debited|credited|spent|paid|received|refund(ed)?)\b/i.test(text)) {
    return {
      classification: "NON_TRANSACTION",
      type: null,
      amount,
      payee: null,
      accountLast4,
      confidence: 0.9,
      reason: "sms-classifier: matched payment-due reminder pattern — not a transaction",
      warnings,
    };
  }

  // --- TRANSACTION: credit-card bill payment received -> transfer, NEVER income ---
  if (/\bpayment\b.{0,20}\breceived\b.{0,20}\b(towards|against|for)\b.{0,25}\bcredit\s*card\b/i.test(text)) {
    return {
      classification: "TRANSACTION",
      type: "transfer",
      amount,
      payee: "Credit card payment",
      accountLast4,
      confidence: 0.85,
      reason: "sms-classifier: credit-card bill payment received — classified as transfer, not income",
      warnings,
    };
  }

  // --- TRANSACTION: refund ---
  if (/\brefund(ed)?\b/i.test(text)) {
    if (amount === null) warnings.push("Refund keyword found but no amount detected.");
    return {
      classification: "TRANSACTION",
      type: "refund",
      amount,
      payee: extractCreditPayee(text) ?? extractDebitPayee(text),
      accountLast4,
      confidence: amount !== null ? 0.75 : 0.4,
      reason: "sms-classifier: matched anchor \"refund\"",
      warnings,
    };
  }

  // --- TRANSACTION: card purchase / debit ("spent", "debited", "paid") -> expense ---
  if (/\b(spent|debited|paid)\b/i.test(text)) {
    const payee = extractCardPurchasePayee(text) ?? extractDebitPayee(text);
    if (amount === null) warnings.push("Debit keyword found but no amount detected.");
    if (!payee) warnings.push("Could not identify a payee/merchant.");
    return {
      classification: "TRANSACTION",
      type: "expense",
      amount,
      payee,
      accountLast4,
      confidence: amount !== null && payee ? 0.85 : 0.55,
      reason: "sms-classifier: matched a debit anchor (spent/debited/paid)",
      warnings,
    };
  }

  // --- TRANSACTION: credit ("credited", "received") -> ambiguous income/refund/transfer, low(er) confidence ---
  if (/\b(credited|received)\b/i.test(text)) {
    const payee = extractCreditPayee(text);
    if (!payee) warnings.push("Could not identify who sent this credit.");
    return {
      classification: "TRANSACTION",
      type: "income",
      amount,
      payee,
      accountLast4,
      confidence: 0.5, // deliberately low — could be income, refund, or transfer (project-spec-truth.md §"BANK STATEMENT IMPORT")
      reason: "sms-classifier: matched a credit anchor (credited/received) — type is a conservative guess, needs review",
      warnings: [...warnings, "Credited amount could be income, refund, or transfer — verify before confirming."],
    };
  }

  // --- No recognizable pattern at all ---
  return {
    classification: "UNKNOWN",
    type: null,
    amount,
    payee: null,
    accountLast4,
    confidence: 0.2,
    reason: "sms-classifier: no recognized transaction or non-transaction pattern",
    warnings: ["Unrecognized SMS format — needs manual review."],
  };
}
