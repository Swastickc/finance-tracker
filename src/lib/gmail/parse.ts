import { AMOUNT_ANCHORS, KNOWN_TRANSACTION_SENDERS } from "@/lib/gmail/known-senders";
import type { DryRunConfidence } from "@/lib/gmail/types";

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
  detectedAmount: number | null;
  merchant: string | null;
  type: "expense" | "income" | "refund" | null;
  category: string | null;
  confidence: DryRunConfidence;
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

function guessType(text: string, anchor: string): "expense" | "income" | "refund" | null {
  const lower = text.toLowerCase();
  if (lower.includes("refund")) return "refund";
  if (anchor === "credited" || anchor === "received") return "income";
  if (anchor === "debited" || anchor === "spent" || anchor === "paid") return "expense";
  return null;
}

/**
 * Semantic-anchor extraction (PROJECT_SPEC.md §7) — pure, no network calls.
 *
 * This is a generic first pass, not tuned to any specific bank/merchant email
 * format (we haven't inspected real samples yet — see PROJECT_SPEC.md §7:
 * "Do not guess email formats"). Treat DRY RUN output as a starting point for
 * human review, not ground truth, until validated against real emails.
 */
export function parseEmail(from: string, subject: string, body: string): ParsedEmail {
  const warnings: string[] = [];
  const text = `${subject}\n${body}`;

  const anchored = findAnchoredAmount(text);
  let detectedAmount: number | null = null;
  let type: "expense" | "income" | "refund" | null = null;

  if (anchored) {
    detectedAmount = anchored.amount;
    type = guessType(text, anchored.anchor);
  } else {
    const fallback = text.match(AMOUNT_PATTERN);
    if (fallback) {
      detectedAmount = Number(fallback[1].replace(/,/g, ""));
      warnings.push("Amount found without a nearby semantic anchor — verify manually.");
    } else {
      warnings.push("No amount detected in this message.");
    }
  }

  const merchant = guessMerchant(from, subject);
  if (!merchant) warnings.push("Could not match a known merchant — needs manual identification.");

  const category = merchant ? MERCHANT_CATEGORY[merchant] ?? null : null;

  let confidence: DryRunConfidence = "low";
  if (anchored && merchant) confidence = "high";
  else if (anchored || merchant) confidence = "medium";

  return { detectedAmount, merchant, type, category, confidence, warnings };
}
