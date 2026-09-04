import { describe, expect, it } from "vitest";
import { mapRowsToTransactions } from "@/lib/sheets/mapRow";

describe("mapRowsToTransactions", () => {
  it("maps a normal 4-column row to an expense transaction (existing pipeline unchanged)", () => {
    const { transactions, warnings } = mapRowsToTransactions([["9/4/2026 12:59:53", "BHOLA SHAW", "160", "Smoke"]]);
    expect(transactions).toHaveLength(1);
    expect(transactions[0].type).toBe("expense");
    expect(transactions[0].merchant).toBe("BHOLA SHAW");
    expect(warnings).toHaveLength(0);
  });

  it("does not import a row whose text is an unambiguous non-transaction signal", () => {
    const { transactions, warnings } = mapRowsToTransactions([
      ["9/4/2026 12:59:53", "OTP verification code", "160", "otp for txn"],
    ]);
    expect(transactions).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
