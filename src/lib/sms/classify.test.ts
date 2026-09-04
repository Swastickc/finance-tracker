import { describe, expect, it } from "vitest";
import { classifySmsText } from "@/lib/sms/classify";

describe("classifySmsText", () => {
  it("classifies an ICICI debit SMS as an expense", () => {
    const result = classifySmsText(
      "ICICI Bank Acct XX518 debited for Rs 500.00 on 04-Sep-26; SYED JUNAID AHM credited. UPI:624718042716..."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(500);
    expect(result.payee).toBe("SYED JUNAID AHM");
  });

  it("classifies an ICICI credit SMS as an ambiguous income (needs review)", () => {
    const result = classifySmsText(
      "Dear Customer, Acct XX518 is credited with Rs 250.00 on 04-Sep-26 from TIYASHA MISRA. UPI:874724758233..."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("income");
    expect(result.amount).toBe(250);
    expect(result.payee).toBe("TIYASHA MISRA");
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("classifies an HDFC card purchase SMS as an expense", () => {
    const result = classifySmsText(
      "Spent Rs.2546.23 On HDFC Bank Card 8721 At AmazonSellerServices On 2026-09-04:08:24:31..."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("expense");
    expect(result.amount).toBe(2546.23);
    expect(result.payee).toBe("AmazonSellerServices");
    expect(result.accountLast4).toBe("8721");
  });

  it("classifies an HDFC OTP SMS as NON_TRANSACTION (does not create a duplicate expense)", () => {
    const result = classifySmsText(
      "OTP is 288505 for txn of INR 2546.23 at AmazonSelle on HDFC Bank card ending 8721..."
    );
    expect(result.classification).toBe("NON_TRANSACTION");
    expect(result.type).toBeNull();
  });

  it("classifies an HDFC credit-card payment received SMS as a transfer, not income", () => {
    const result = classifySmsText(
      "PAYMENT OF Rs.12797.00 RECEIVED TOWARDS YOUR CREDIT CARD ENDING WITH 8721..."
    );
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("transfer");
    expect(result.amount).toBe(12797);
  });

  it("classifies a credit-card due reminder as NON_TRANSACTION", () => {
    const result = classifySmsText("Rs 25941.6 is due on ICICI Bank Credit Card...");
    expect(result.classification).toBe("NON_TRANSACTION");
    expect(result.type).toBeNull();
  });

  it("classifies a refund SMS as type refund", () => {
    const result = classifySmsText("Rs.899.00 has been refunded to your account for order #12345 from Flipkart.");
    expect(result.classification).toBe("TRANSACTION");
    expect(result.type).toBe("refund");
    expect(result.amount).toBe(899);
  });

  it("classifies an unrecognized SMS format as UNKNOWN", () => {
    const result = classifySmsText("Your monthly statement is now available on the app.");
    expect(result.classification).toBe("UNKNOWN");
    expect(result.type).toBeNull();
  });

  it("does not create two expenses for one purchase: OTP + debit SMS pair (test 7)", () => {
    const otp = classifySmsText("OTP is 288505 for txn of INR 2546.23 at AmazonSelle on HDFC Bank card ending 8721...");
    const purchase = classifySmsText(
      "Spent Rs.2546.23 On HDFC Bank Card 8721 At AmazonSellerServices On 2026-09-04:08:24:31..."
    );
    const results = [otp, purchase];
    const transactionCount = results.filter((r) => r.classification === "TRANSACTION").length;
    expect(transactionCount).toBe(1);
    expect(otp.classification).toBe("NON_TRANSACTION");
    expect(purchase.classification).toBe("TRANSACTION");
  });
});
