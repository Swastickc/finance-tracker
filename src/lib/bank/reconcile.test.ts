import { describe, expect, it } from "vitest";
import { parseStatementRows } from "@/lib/bank/parseStatement";
import { normalizeBankRow } from "@/lib/bank/normalize";
import { reconcileBankTransactions } from "@/lib/bank/reconcile";
import { BANK_STATEMENT_COLUMNS } from "@/lib/bank/types";

const HEADER = [...BANK_STATEMENT_COLUMNS];

describe("normalizeBankRow", () => {
  it("marks withdrawals as expense, review status, moderate confidence", () => {
    const { rows } = parseStatementRows([HEADER, ["1", "01/08/2026", "01/08/2026", "", "UPI-ZOMATO", "640.00", "", "1000"]]);
    const t = normalizeBankRow(rows[0], "StatementA.xls");
    expect(t.type).toBe("expense");
    expect(t.status).toBe("review");
    expect(t.merchant).toBeNull();
    expect(t.rawDescription).toBe("UPI-ZOMATO");
    expect(t.source).toBe("import");
  });

  it("marks deposits as a low-confidence income placeholder, never auto-confirmed", () => {
    const { rows } = parseStatementRows([HEADER, ["2", "02/08/2026", "02/08/2026", "", "NEFT CR", "", "5000.00", "6000"]]);
    const t = normalizeBankRow(rows[0], "StatementA.xls");
    expect(t.type).toBe("income");
    expect(t.status).toBe("review");
    expect(t.confidence).toBeLessThan(0.5);
  });

  it("never classifies a self-transfer looking deposit as confirmed income", () => {
    const { rows } = parseStatementRows([HEADER, ["3", "03/08/2026", "03/08/2026", "", "OWN ACCOUNT TRANSFER", "", "2000.00", "8000"]]);
    const t = normalizeBankRow(rows[0], "StatementA.xls");
    expect(t.status).toBe("review");
  });
});

describe("reconcileBankTransactions — cross-statement overlap (test 8)", () => {
  it("marks an exact-match row appearing in two overlapping statements as ignored, not deleted", () => {
    const { rows: rowsA } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-SWIGGY-998", "450.00", "", "10000"],
    ]);
    const { rows: rowsB } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-SWIGGY-998", "450.00", "", "10000"],
    ]);

    const txA = normalizeBankRow(rowsA[0], "OpTransactionHistory.xls");
    const txB = normalizeBankRow(rowsB[0], "Newopstrans.xls");

    const result = reconcileBankTransactions([txA, txB]);
    expect(result.transactions).toHaveLength(2); // both retained
    expect(result.exactDuplicateCount).toBe(1);
    const ignored = result.transactions.find((t) => t.status === "ignored");
    expect(ignored).toBeDefined();
    expect(ignored?.classificationNote).toContain("exact duplicate");
  });

  it("flags same date+amount but different remarks as a possible duplicate instead of auto-resolving", () => {
    const { rows: rowsA } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-SWIGGY-998", "450.00", "", "10000"],
    ]);
    const { rows: rowsB } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-9988776655", "450.00", "", "10000"],
    ]);

    const txA = normalizeBankRow(rowsA[0], "OpTransactionHistory.xls");
    const txB = normalizeBankRow(rowsB[0], "Newopstrans.xls");

    const result = reconcileBankTransactions([txA, txB]);
    expect(result.exactDuplicateCount).toBe(0);
    expect(result.transactions.every((t) => t.status !== "ignored")).toBe(true);
    expect(result.possibleDuplicates).toHaveLength(1);
  });

  it("does not treat two different real transactions on the same day as duplicates", () => {
    const { rows: rowsA } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-SWIGGY-998", "450.00", "", "10000"],
    ]);
    const { rows: rowsB } = parseStatementRows([
      HEADER,
      ["1", "15/08/2026", "15/08/2026", "", "UPI-RAPIDO-321", "210.00", "", "9790"],
    ]);

    const txA = normalizeBankRow(rowsA[0], "OpTransactionHistory.xls");
    const txB = normalizeBankRow(rowsB[0], "Newopstrans.xls");

    const result = reconcileBankTransactions([txA, txB]);
    expect(result.exactDuplicateCount).toBe(0);
    expect(result.possibleDuplicates).toHaveLength(0);
    expect(result.transactions.every((t) => t.status === "review")).toBe(true);
  });
});
