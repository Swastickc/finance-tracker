import { AMOUNT_ANCHORS, KNOWN_TRANSACTION_SENDERS } from "@/lib/gmail/known-senders";
import type { DryRunConfidence, GmailClassification, NonTransactionReason } from "@/lib/gmail/types";

const AMOUNT_PATTERN = /(?:rs\.?|inr|₹)\s?([\d,]+(?:\.\d{1,2})?)/i;
const ANCHOR_WINDOW = 40; // characters of proximity between an anchor keyword and an amount

const MERCHANT_CATEGORY: Record<string, string> = {
  Amazon: "Shopping",
  "Amazon Pay": "Shopping",
  Zomato: "Food",
  "Reliance Digital": "Shopping",
  Rapido: "Transport",
  Flipkart: "Shopping",
  "AJIO Luxe": "Shopping",
  Myntra: "Shopping",
  Shopify: "Other",
  Stake: "Entertainment",
  "Prime Video": "Subscriptions",
  Shiprocket: "Other",
  "Ola Cabs": "Transport",
  District: "Entertainment",
  Xiaomi: "Shopping",
  Swiggy: "Food",
  OlaMoney: "Transport",
  Razorpay: "Other",
  Snitch: "Shopping",
};

export interface ParsedEmail {
  classification: GmailClassification;
  nonTransactionReason: NonTransactionReason;
  detectedAmount: number | null;
  merchant: string | null;
  type: "expense" | "income" | "refund" | "transfer" | null;
  category: string | null;
  confidence: DryRunConfidence;
  classificationNote: string;
  warnings: string[];
}

function findAnchoredAmount(text: string): { amount: number; anchor: string } | null {
  const lower = text.toLowerCase();
  for (const anchor of AMOUNT_ANCHORS) {
    let searchFrom = 0;
    let idx = lower.indexOf(anchor, searchFrom);
    while (idx !== -1) {
      const start = Math.max(0, idx - ANCHOR_WINDOW);
      const end = Math.min(text.length, idx + anchor.length + ANCHOR_WINDOW);
      const window = text.slice(start, end);
      const match = window.match(AMOUNT_PATTERN);
      if (match) {
        const amount = Number(match[1].replace(/,/g, ""));
        if (Number.isFinite(amount)) return { amount, anchor };
      }
      searchFrom = idx + anchor.length;
      idx = lower.indexOf(anchor, searchFrom);
    }
  }
  return null;
}

function guessMerchant(from: string, subject: string): string | null {
  const haystack = `${from} ${subject}`.toLowerCase();
  return KNOWN_TRANSACTION_SENDERS.find((s) => haystack.includes(s.toLowerCase())) ?? null;
}

function result(partial: Partial<ParsedEmail> & Pick<ParsedEmail, "classification" | "classificationNote">): ParsedEmail {
  return {
    nonTransactionReason: null,
    detectedAmount: null,
    merchant: null,
    type: null,
    category: null,
    confidence: "low",
    warnings: [],
    ...partial,
  };
}

/**
 * Semantic-anchor classification/extraction (project-spec-truth.md §"GMAIL
 * IMPORTER" / §"HISTORICAL GMAIL"). Pure, no network calls.
 *
 * This is a generic first pass, not tuned to any specific bank/merchant email
 * format — real samples have not been inspected (see PROJECT_SPEC.md §7: "Do
 * not guess email formats"). Treat DRY RUN output as a starting point for
 * human review, not ground truth, until validated against real emails.
 *
 * Classification order (most specific non-transaction signal first, so an
 * OTP or due-reminder mentioning an amount is never mistaken for a
 * transaction):
 *   1. OTP -> NON_TRANSACTION
 *   2. Due/payment reminder (no action verb) -> NON_TRANSACTION
 *   3. Promotional (unsubscribe-style, no anchored amount) -> NON_TRANSACTION
 *   4. Credit-card payment received -> TRANSACTION, type "transfer" (never income)
 *   5. Refund -> TRANSACTION, type "refund"
 *   6. Debited/spent/paid -> TRANSACTION, type "expense"
 *   7. Credited/received -> TRANSACTION, type "income" (low confidence — could
 *      be a refund or transfer instead; never silently assumed)
 *   8. Amount found with no anchor at all -> UNKNOWN (ambiguous, not trusted)
 *   9. Nothing recognizable -> UNKNOWN
 */
export function parseEmail(from: string, subject: string, body: string): ParsedEmail {
  const text = `${subject}\n${body}`;

  if (/\botp\b/i.test(text) || /\bone[\s-]?time\s+password\b/i.test(text)) {
    return result({
      classification: "NON_TRANSACTION",
      nonTransactionReason: "otp",
      confidence: "high",
      classificationNote: "gmail-classifier: matched OTP pattern — not a transaction",
    });
  }

  if (
    /\b(is\s+due|payment\s+due|due\s+on|due\s+date|minimum\s+amount\s+due)\b/i.test(text) &&
    !/\b(debited|credited|spent|paid|received|refund(ed)?)\b/i.test(text)
  ) {
    return result({
      classification: "NON_TRANSACTION",
      nonTransactionReason: "due_reminder",
      confidence: "high",
      classificationNote: "gmail-classifier: matched payment-due reminder pattern — not a transaction",
    });
  }

  const anchored = findAnchoredAmount(text);

  if (!anchored && /\bunsubscribe\b/i.test(text)) {
    return result({
      classification: "NON_TRANSACTION",
      nonTransactionReason: "promotional",
      confidence: "medium",
      classificationNote: "gmail-classifier: looks promotional (unsubscribe link, no transaction anchor) — not a transaction",
    });
  }

  if (/\bpayment\b.{0,20}\breceived\b.{0,20}\b(towards|against|for)\b.{0,25}\bcredit\s*card\b/i.test(text)) {
    return result({
      classification: "TRANSACTION",
      type: "transfer",
      detectedAmount: anchored?.amount ?? null,
      merchant: "Credit card payment",
      confidence: "medium",
      classificationNote: "gmail-classifier: credit-card bill payment received — classified as transfer, not income",
    });
  }

  const merchant = guessMerchant(from, subject);
  const warnings: string[] = [];

  if (/\brefund(ed)?\b/i.test(text)) {
    const amount = anchored?.amount ?? null;
    if (amount === null) warnings.push("Refund keyword found but no amount detected.");
    return result({
      classification: "TRANSACTION",
      type: "refund",
      detectedAmount: amount,
      merchant,
      category: merchant ? (MERCHANT_CATEGORY[merchant] ?? null) : null,
      confidence: amount !== null ? "high" : "low",
      classificationNote: 'gmail-classifier: matched anchor "refund"',
      warnings,
    });
  }

  if (anchored && (anchored.anchor === "debited" || anchored.anchor === "spent" || anchored.anchor === "paid")) {
    if (!merchant) warnings.push("Could not match a known merchant — needs manual identification.");
    return result({
      classification: "TRANSACTION",
      type: "expense",
      detectedAmount: anchored.amount,
      merchant,
      category: merchant ? (MERCHANT_CATEGORY[merchant] ?? null) : null,
      confidence: merchant ? "high" : "medium",
      classificationNote: "gmail-classifier: matched a debit anchor (spent/debited/paid)",
      warnings,
    });
  }

  if (anchored && (anchored.anchor === "credited" || anchored.anchor === "received")) {
    if (!merchant) warnings.push("Could not match a known merchant — needs manual identification.");
    return result({
      classification: "TRANSACTION",
      type: "income",
      detectedAmount: anchored.amount,
      merchant,
      category: merchant ? (MERCHANT_CATEGORY[merchant] ?? null) : null,
      confidence: "low", // deliberately low — could be income, refund, or transfer; never silently assumed
      classificationNote: "gmail-classifier: matched a credit anchor (credited/received) — type is a conservative guess, needs review",
      warnings: [...warnings, "Credited amount could be income, refund, or transfer — verify before confirming."],
    });
  }

  if (anchored) {
    // "transaction amount"/"total amount" anchors matched but direction is unclear.
    if (!merchant) warnings.push("Could not match a known merchant — needs manual identification.");
    return result({
      classification: "UNKNOWN",
      detectedAmount: anchored.amount,
      merchant,
      confidence: "low",
      classificationNote: `gmail-classifier: matched anchor "${anchored.anchor}" but the transaction direction (expense/income) is unclear`,
      warnings: [...warnings, "Amount found but expense/income direction is ambiguous — needs manual review."],
    });
  }

  const fallback = text.match(AMOUNT_PATTERN);
  if (fallback) {
    const amount = Number(fallback[1].replace(/,/g, ""));
    return result({
      classification: "UNKNOWN",
      detectedAmount: Number.isFinite(amount) ? amount : null,
      merchant,
      confidence: "low",
      classificationNote: "gmail-classifier: amount found without a nearby semantic anchor",
      warnings: ["Amount found without a nearby semantic anchor — verify manually."],
    });
  }

  return result({
    classification: "UNKNOWN",
    merchant,
    confidence: "low",
    classificationNote: "gmail-classifier: no recognized transaction or non-transaction pattern",
    warnings: ["No amount detected and no recognizable pattern — needs manual review."],
  });
}

