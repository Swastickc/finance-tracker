import { describe, expect, it } from "vitest";
import { findCrossSourceDuplicates } from "@/lib/canonical/reconcile";
import { normalizeBankRow } from "@/lib/bank/normalize";
import { parseStatementRows } from "@/lib/bank/parseStatement";
import { BANK_STATEMENT_COLUMNS } from "@/lib/bank/types";
import type { Transaction } from "@/lib/types";

const HEADER = [...BANK_STATEMENT_COLUMNS];

function bankTx(remarks: string, amount: string, date = "15/08/2026", direction: "withdrawal" | "deposit" = "withdrawal"): Transaction {
  const row =
    direction === "withdrawal"
      ? ["1", date, date, "", remarks, amount, "", "10000"]
      : ["1", date, date, "", remarks, "", amount, "10000"];
  const { rows } = parseStatementRows([HEADER, row]);
  return normalizeBankRow(rows[0], "OpTransactionHistory.xls");
}

function smsTx(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id: "sms-1",
    transactionDate: "2026-08-15",
    transactionTime: "12:00",
    amount: 450,
    currency: "INR",
    type: "expense",
    merchant: "Swiggy",
    rawDescription: "Rs.450.00 debited for SWIGGY ORDER",
    category: "Food",
    subcategory: null,
    account: null,
    paymentMethod: "UPI",
    source: "sms",
    sourceMessageId: null,
    status: "confirmed",
    confidence: 0.9,
    isRecurring: false,
    ruleId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function gmailTx(overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id: "gmail-1",
    transactionDate: "2026-08-15",
    transactionTime: null,
    amount: 450,
    currency: "INR",
    type: "expense",
    merchant: "Swiggy",
    rawDescription: "Your Swiggy order for Rs.450 has been placed",
    category: "Food",
    subcategory: null,
    account: null,
    paymentMethod: null,
    source: "gmail",
    sourceMessageId: "gmail-msg-1",
    status: "review",
    confidence: 0.7,
    isRecurring: false,
    ruleId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("findCrossSourceDuplicates", () => {
  it("flags the same transaction appearing in a bank statement and an SMS (test 10)", () => {
    const bank = bankTx("UPI-SWIGGY-998", "450.00");
    const sms = smsTx({});
    const matches = findCrossSourceDuplicates([bank, sms]);
    expect(matches).toHaveLength(1);
    expect(matches[0].confidence).toBe("high");
  });

  it("flags the same transaction appearing in a bank statement and a Gmail email (test 9)", () => {
    const bank = bankTx("UPI-SWIGGY-998", "450.00");
    const gmail = gmailTx({});
    const matches = findCrossSourceDuplicates([bank, gmail]);
    expect(matches).toHaveLength(1);
  });

  it("does not flag unrelated transactions from different sources on different days/amounts", () => {
    const bank = bankTx("UPI-RAPIDO-321", "210.00", "16/08/2026");
    const sms = smsTx({});
    const matches = findCrossSourceDuplicates([bank, sms]);
    expect(matches).toHaveLength(0);
  });

  it("never removes any record — only reports candidate pairs", () => {
    const bank = bankTx("UPI-SWIGGY-998", "450.00");
    const sms = smsTx({});
    const before = [bank, sms];
    findCrossSourceDuplicates(before);
    expect(before).toHaveLength(2);
  });
});

describe("own-account transfer and refund detection from bank remarks", () => {
  it("classifies an own-account transfer deposit as transfer, not income (test 11)", () => {
    const t = bankTx("TRANSFER TO OWN ACCOUNT SBI", "5000.00");
    expect(t.type).toBe("transfer");
    expect(t.status).toBe("review");
  });

  it("classifies a refund-worded deposit as refund, not ordinary income (test 12)", () => {
    const t = bankTx("REFUND FROM FLIPKART ORDER", "899.00", "15/08/2026", "deposit");
    expect(t.type).toBe("refund");
  });
});
