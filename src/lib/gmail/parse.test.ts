import { describe, expect, it } from "vitest";
import { parseEmail } from "@/lib/gmail/parse";

describe("parseEmail", () => {
  it("extracts amount, merchant, and type from a recognizable transaction email", () => {
    const result = parseEmail(
      "Amazon.in <auto-confirm@amazon.in>",
      "Your Amazon.in order has been shipped",
      "Hi, your card was debited Rs. 2,499.00 for order #402-1234567. Total amount charged: Rs. 2,499.00."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.detectedAmount).toBe(2499);
    expect(result.merchant).toBe("Amazon");
    expect(result.type).toBe("expense");
    expect(result.confidence).toBe("high");
  });

  it("handles an unrecognized email format as UNKNOWN, not invented data (test 14)", () => {
    const result = parseEmail(
      "unknownsender@example.com",
      "Payment notification",
      "This is a notification email with no clear amount or merchant reference."
    );
    expect(result.classification).toBe("UNKNOWN");
    expect(result.detectedAmount).toBeNull();
    expect(result.merchant).toBeNull();
    expect(result.confidence).toBe("low");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("excludes an OTP email as NON_TRANSACTION even though it mentions an amount", () => {
    const result = parseEmail(
      "HDFC Bank <alerts@hdfcbank.net>",
      "OTP for your transaction",
      "Your OTP is 482913 for a txn of INR 2499.00 at AmazonSelle on HDFC Bank card ending 8721."
    );
    expect(result.classification).toBe("NON_TRANSACTION");
    expect(result.nonTransactionReason).toBe("otp");
    expect(result.type).toBeNull();
  });

  it("excludes a credit-card due reminder as NON_TRANSACTION", () => {
    const result = parseEmail(
      "HDFC Bank <alerts@hdfcbank.net>",
      "Payment due reminder",
      "Rs 12,500.00 is due on your HDFC Bank Credit Card. Please pay by the due date to avoid late fees."
    );
    expect(result.classification).toBe("NON_TRANSACTION");
    expect(result.nonTransactionReason).toBe("due_reminder");
  });

  it("excludes a promotional email with no transaction anchor", () => {
    const result = parseEmail(
      "Flipkart <deals@flipkart.com>",
      "Big Billion Days is here!",
      "Huge discounts on electronics. Shop now! Unsubscribe from these emails at any time."
    );
    expect(result.classification).toBe("NON_TRANSACTION");
    expect(result.nonTransactionReason).toBe("promotional");
  });

  it("classifies a credit-card payment received email as a transfer, not income", () => {
    const result = parseEmail(
      "HDFC Bank <alerts@hdfcbank.net>",
      "Credit card payment received",
      "PAYMENT OF Rs.12797.00 RECEIVED TOWARDS YOUR CREDIT CARD ENDING WITH 8721. Thank you."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("transfer");
    expect(result.detectedAmount).toBe(12797);
  });

  it("classifies a refund email as type refund", () => {
    const result = parseEmail(
      "Flipkart <noreply@flipkart.com>",
      "Refund processed",
      "Rs.899.00 has been refunded to your account for order #12345."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("refund");
    expect(result.detectedAmount).toBe(899);
  });

  it("never silently assumes a credited email is income — low confidence, explicit note", () => {
    const result = parseEmail(
      "SBI <alerts@sbi.co.in>",
      "Account credited",
      "Your account has been credited with Rs.5000.00 from a sender."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("income");
    expect(result.confidence).toBe("low");
    expect(result.classificationNote.toLowerCase()).toContain("conservative guess");
  });

  it("classifies an amount found without a nearby anchor as UNKNOWN (ambiguous), not a trusted transaction", () => {
    const result = parseEmail(
      "someone@example.com",
      "Your order",
      "Reference number 12345, amount Rs. 500.00, thank you for shopping."
    );
    expect(result.classification).toBe("UNKNOWN");
    expect(result.detectedAmount).toBe(500);
  });
});
