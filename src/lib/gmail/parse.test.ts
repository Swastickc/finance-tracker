import { describe, expect, it } from "vitest";
import { parseEmail } from "@/lib/gmail/parse";

describe("parseEmail", () => {
  it("extracts amount, merchant, and type from a recognizable transaction email", () => {
    const result = parseEmail(
      "Amazon.in <auto-confirm@amazon.in>",
      "Your Amazon.in order has been shipped",
      "Hi, your card was debited Rs. 2,499.00 for order #402-1234567. Total amount charged: Rs. 2,499.00."
    );
    expect(result.detectedAmount).toBe(2499);
    expect(result.merchant).toBe("Amazon");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("high");
  });

  it("handles an unrecognized email format with low confidence and warnings, not invented data (test 14)", () => {
    const result = parseEmail(
      "unknownsender@example.com",
      "Payment notification",
      "This is a notification email with no clear amount or merchant reference."
    );
    expect(result.detectedAmount).toBeNull();
    expect(result.merchant).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
