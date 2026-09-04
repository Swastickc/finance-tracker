import { describe, expect, it } from "vitest";
import { parseStatementRows } from "@/lib/bank/parseStatement";
import { BANK_STATEMENT_COLUMNS } from "@/lib/bank/types";

// Synthetic fixture rows shaped exactly like the known column layout
// (project-spec-truth.md). Values are made up for testing only — not a
// claim about the real statement's actual contents.
const HEADER = [...BANK_STATEMENT_COLUMNS];

describe("parseStatementRows", () => {
  it("parses a withdrawal row", () => {
    const rows = [
      HEADER,
      ["1", "01/08/2026", "01/08/2026", "", "UPI-AMAZON-1234", "1499.00", "", "50000.00"],
    ];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      transactionDate: "2026-08-01",
      amount: 1499,
      direction: "withdrawal",
      balance: 50000,
      transactionRemarks: "UPI-AMAZON-1234",
    });
  });

  it("parses a deposit row", () => {
    const rows = [
      HEADER,
      ["2", "02/08/2026", "02/08/2026", "", "SALARY CREDIT", "", "85000.00", "135000.00"],
    ];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].direction).toBe("deposit");
    expect(result.rows[0].amount).toBe(85000);
  });

  it("parses DD-Mon-YY style dates", () => {
    const rows = [HEADER, ["3", "04-Sep-26", "04-Sep-26", "", "ATM WDL", "2000.00", "", "10000.00"]];
    const result = parseStatementRows(rows);
    expect(result.rows[0].transactionDate).toBe("2026-09-04");
  });

  it("skips a malformed row with no date and reports a warning", () => {
    const rows = [HEADER, ["4", "", "", "", "GARBAGE ROW", "100.00", "", "9900.00"]];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips a row with neither withdrawal nor deposit amount", () => {
    const rows = [HEADER, ["5", "01/08/2026", "01/08/2026", "", "NO AMOUNT", "", "", "9900.00"]];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips a row with both withdrawal and deposit present (ambiguous)", () => {
    const rows = [HEADER, ["6", "01/08/2026", "01/08/2026", "", "AMBIGUOUS", "100.00", "200.00", "9900.00"]];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("skips fully blank trailing rows without warnings", () => {
    const rows = [HEADER, ["", "", "", "", "", "", "", ""]];
    const result = parseStatementRows(rows);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});
