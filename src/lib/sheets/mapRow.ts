import { CATEGORIES, type Category, type Transaction } from "@/lib/types";
import { classifySmsText } from "@/lib/sms/classify";

/**
 * The real spreadsheet (confirmed by the user, 2026-09-04) has NO header
 * row — it's a raw dump with 4 fixed columns:
 *   A: datetime as "M/D/YYYY H:mm:ss"
 *   B: payee/sender (a name or UPI reference — not a normalized merchant)
 *   C: amount
 *   D: a free-text note/tag (not one of our fixed categories, e.g. "Smoke")
 *
 * Everything below is positional, not header-based. If the pipeline's
 * columns ever change, update COLUMN_INDEX — nothing else needs to change.
 */
const COLUMN_INDEX = { dateTime: 0, payee: 1, amount: 2, note: 3 } as const;

/** Imported rows can't be parsed with real confidence, so they're always
 *  surfaced in the Review queue (PROJECT_SPEC.md §20) below this threshold. */
const IMPORTED_ROW_CONFIDENCE = 0.6;

function parseDateTime(raw: string): { date: string; time: string } | null {
  // "9/4/2026 12:59:53" -> date "2026-09-04", time "12:59"
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const [, m, d, y, h, min] = match;
  return { date: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`, time: `${h.padStart(2, "0")}:${min}` };
}

function matchCategory(note: string): Category {
  return CATEGORIES.find((c) => c.toLowerCase() === note.trim().toLowerCase()) ?? "Uncategorized";
}

export interface MapRowsResult {
  transactions: Transaction[];
  /** Row-number-only warnings — never includes amounts/payee content (privacy). */
  warnings: string[];
}

/** Pure row->Transaction mapping. No network calls, no AI — safe to unit test. */
export function mapRowsToTransactions(rows: string[][]): MapRowsResult {
  const warnings: string[] = [];
  const transactions: Transaction[] = [];

  rows.forEach((row, i) => {
    const rowNumber = i + 1; // 1-based, matches the sheet's row number (no header row to skip)
    const rawDateTime = row[COLUMN_INDEX.dateTime]?.trim();
    const payee = row[COLUMN_INDEX.payee]?.trim() || null;
    const rawAmount = row[COLUMN_INDEX.amount]?.trim();
    const note = row[COLUMN_INDEX.note]?.trim() ?? "";

    if (!rawDateTime || !rawAmount) {
      warnings.push(`Row ${rowNumber}: missing date or amount — skipped.`);
      return;
    }

    const parsed = parseDateTime(rawDateTime);
    if (!parsed) {
      warnings.push(`Row ${rowNumber}: unrecognized date format — skipped.`);
      return;
    }

    const amount = Number(rawAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount)) {
      warnings.push(`Row ${rowNumber}: amount is not a number — skipped.`);
      return;
    }

    const timestamp = `${parsed.date}T${parsed.time}:00Z`;

    // Defensive secondary check: this 4-column dump is already a reduced/
    // pre-filtered view (not raw SMS bodies), so classifySmsText() rarely
    // matches anything here — but if the payee/note text ever contains an
    // unambiguous non-transaction signal (OTP, due reminder), don't import
    // it as a false expense. Does NOT change the existing pipeline/schema.
    const secondaryCheck = classifySmsText([payee, note].filter(Boolean).join(" "));
    if (secondaryCheck.classification === "NON_TRANSACTION") {
      warnings.push(`Row ${rowNumber}: looks like a non-transaction message (${secondaryCheck.reason}) — skipped.`);
      return;
    }

    transactions.push({
      id: `sheet-row-${rowNumber}`,
      transactionDate: parsed.date,
      transactionTime: parsed.time,
      amount,
      currency: "INR",
      type: "expense",
      merchant: payee,
      rawDescription: [payee, rawAmount, note].filter(Boolean).join(" · ") || rawDateTime,
      category: note ? matchCategory(note) : "Uncategorized",
      subcategory: note || null,
      account: null,
      paymentMethod: null,
      source: "sms",
      sourceMessageId: null,
      status: "review",
      confidence: IMPORTED_ROW_CONFIDENCE,
      isRecurring: false,
      ruleId: null,
      classificationNote: "sheets-mapper: 4-column SMS dump, positional (see file header comment); type defaulted to expense",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  return { transactions, warnings };
}

