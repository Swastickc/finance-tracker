import type { Transaction, CategoryRule, ImportRecord } from "@/lib/types";

// Realistic mock data standing in for the SMS/Gmail/Sheets pipeline until
// Phase 5 (Google Sheets integration) is wired up. Shape matches the unified
// transaction schema so swapping the data source later requires no UI changes.

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "transactionDate" | "amount" | "type" | "merchant" | "rawDescription" | "category">): Transaction {
  return {
    transactionTime: null,
    currency: "INR",
    subcategory: null,
    account: "HDFC •• 4821",
    paymentMethod: "UPI",
    source: "sms",
    sourceMessageId: null,
    status: "confirmed",
    confidence: 0.95,
    isRecurring: false,
    ruleId: null,
    createdAt: `${partial.transactionDate}T${partial.transactionTime ?? "09:00"}:00Z`,
    updatedAt: `${partial.transactionDate}T${partial.transactionTime ?? "09:00"}:00Z`,
    ...partial,
  };
}

export const mockTransactions: Transaction[] = [
  // -- September 2026 (current month) --
  tx({ id: "t-0901", transactionDate: "2026-09-04", transactionTime: "14:32", amount: 1499, type: "expense", merchant: "Amazon", rawDescription: "Rs.1499.00 debited for AMAZON.IN via UPI", category: "Shopping", ruleId: "r-amazon" }),
  tx({ id: "t-0902", transactionDate: "2026-09-04", transactionTime: "09:10", amount: 320, type: "expense", merchant: "Swiggy", rawDescription: "INR 320.00 spent on SWIGGY*ORDER", category: "Food", subcategory: "Delivery", ruleId: "r-swiggy" }),
  tx({ id: "t-0903", transactionDate: "2026-09-03", transactionTime: "19:45", amount: 210, type: "expense", merchant: "Rapido", rawDescription: "Rs.210 debited towards RAPIDO RIDE", category: "Transport", subcategory: "Cab", ruleId: "r-rapido" }),
  tx({ id: "t-0904", transactionDate: "2026-09-02", transactionTime: "12:05", amount: 899, type: "expense", merchant: "Zomato", rawDescription: "Rs.899.00 debited for ZOMATO ONLINE ORDER", category: "Food", subcategory: "Delivery", ruleId: "r-zomato" }),
  tx({ id: "t-0905", transactionDate: "2026-09-02", transactionTime: "08:00", amount: 149, type: "expense", merchant: "Prime Video", rawDescription: "Rs.149.00 debited AMAZON PRIME VIDEO SUBSCRIPTION", category: "Subscriptions", isRecurring: true, ruleId: "r-primevideo" }),
  tx({ id: "t-0906", transactionDate: "2026-09-01", transactionTime: "20:15", amount: 2450, type: "expense", merchant: "Flipkart", rawDescription: "Rs.2450.00 debited for FLIPKART INTERNET PVT LTD", category: "Shopping", ruleId: "r-flipkart" }),
  tx({ id: "t-0907", transactionDate: "2026-09-01", transactionTime: "18:00", amount: 3420, type: "expense", merchant: "Reliance Digital", rawDescription: "Rs.3420.00 debited for RELIANCE DIGITAL STORE", category: "Shopping" }),
  tx({ id: "t-0908", transactionDate: "2026-08-31", transactionTime: "13:30", amount: 640, type: "expense", merchant: "Myntra", rawDescription: "Rs.640.00 debited for MYNTRA DESIGNS", category: "Shopping", subcategory: "Clothing" }),
  tx({ id: "t-0909", transactionDate: "2026-09-04", transactionTime: "07:45", amount: 1200, type: "expense", merchant: null, rawDescription: "Rs.1200.00 debited via UPI to 8899221100@ybl", category: "Uncategorized", status: "review", confidence: 0.4 }),
  tx({ id: "t-0910", transactionDate: "2026-09-03", transactionTime: "22:10", amount: 599, type: "expense", merchant: "District", rawDescription: "Rs.599.00 debited for DISTRICT BY ZOMATO", category: "Entertainment", status: "review", confidence: 0.55 }),
  tx({ id: "t-0911", transactionDate: "2026-09-01", transactionTime: "10:00", amount: 85000, type: "income", merchant: "Employer Payroll", rawDescription: "Rs.85000.00 credited as SALARY CREDIT SEP", category: "Salary", account: "HDFC •• 4821", paymentMethod: "NEFT" }),
  tx({ id: "t-0912", transactionDate: "2026-09-02", transactionTime: "11:20", amount: 5000, type: "transfer", merchant: "Own Account", rawDescription: "Rs.5000.00 transferred to own SBI account", category: "Other", account: "HDFC •• 4821", paymentMethod: "IMPS" }),
  tx({ id: "t-0913", transactionDate: "2026-09-03", transactionTime: "16:40", amount: 899, type: "refund", merchant: "Flipkart", rawDescription: "Rs.899.00 refunded by FLIPKART INTERNET PVT LTD", category: "Shopping" }),
  tx({ id: "t-0914", transactionDate: "2026-09-04", transactionTime: "06:30", amount: 450, type: "expense", merchant: "Ola Cabs", rawDescription: "Rs.450.00 debited for OLA CABS TRIP", category: "Transport", subcategory: "Cab" }),
  tx({ id: "t-0915", transactionDate: "2026-08-30", transactionTime: "21:00", amount: 199, type: "expense", merchant: "Stake", rawDescription: "Rs.199.00 debited for STAKE.COM", category: "Entertainment", status: "review", confidence: 0.5 }),
  tx({ id: "t-0916", transactionDate: "2026-09-02", transactionTime: "12:07", amount: 899, type: "expense", merchant: "Zomato", rawDescription: "Your Zomato order for Rs.899 has been placed and is on its way", category: "Food", subcategory: "Delivery", source: "gmail", sourceMessageId: "gmail-msg-8831", confidence: 0.8, status: "review" }),

  // -- August 2026 (previous month, for comparison) --
  tx({ id: "t-0820", transactionDate: "2026-08-28", transactionTime: "13:00", amount: 1299, type: "expense", merchant: "Amazon", rawDescription: "Rs.1299.00 debited for AMAZON.IN via UPI", category: "Shopping", ruleId: "r-amazon" }),
  tx({ id: "t-0821", transactionDate: "2026-08-25", transactionTime: "20:30", amount: 540, type: "expense", merchant: "Zomato", rawDescription: "Rs.540.00 debited for ZOMATO ONLINE ORDER", category: "Food", subcategory: "Delivery", ruleId: "r-zomato" }),
  tx({ id: "t-0822", transactionDate: "2026-08-22", transactionTime: "09:15", amount: 180, type: "expense", merchant: "Rapido", rawDescription: "Rs.180 debited towards RAPIDO RIDE", category: "Transport", subcategory: "Cab", ruleId: "r-rapido" }),
  tx({ id: "t-0823", transactionDate: "2026-08-20", transactionTime: "17:45", amount: 149, type: "expense", merchant: "Prime Video", rawDescription: "Rs.149.00 debited AMAZON PRIME VIDEO SUBSCRIPTION", category: "Subscriptions", isRecurring: true, ruleId: "r-primevideo" }),
  tx({ id: "t-0824", transactionDate: "2026-08-18", transactionTime: "12:00", amount: 3100, type: "expense", merchant: "AJIO Luxe", rawDescription: "Rs.3100.00 debited for AJIO LUXE ORDER", category: "Shopping", subcategory: "Clothing" }),
  tx({ id: "t-0825", transactionDate: "2026-08-15", transactionTime: "10:00", amount: 82000, type: "income", merchant: "Employer Payroll", rawDescription: "Rs.82000.00 credited as SALARY CREDIT AUG", category: "Salary", paymentMethod: "NEFT" }),
  tx({ id: "t-0826", transactionDate: "2026-08-10", transactionTime: "19:00", amount: 720, type: "expense", merchant: "Swiggy", rawDescription: "INR 720.00 spent on SWIGGY*ORDER", category: "Food", subcategory: "Delivery", ruleId: "r-swiggy" }),
  tx({ id: "t-0827", transactionDate: "2026-08-08", transactionTime: "08:30", amount: 2200, type: "expense", merchant: "Xiaomi", rawDescription: "Rs.2200.00 debited for MI.COM ORDER", category: "Shopping" }),
  tx({ id: "t-0828", transactionDate: "2026-08-05", transactionTime: "15:00", amount: 350, type: "expense", merchant: "Ola Cabs", rawDescription: "Rs.350.00 debited for OLA CABS TRIP", category: "Transport", subcategory: "Cab" }),
];

export const mockCategoryRules: CategoryRule[] = [
  { ruleId: "r-amazon", pattern: "AMAZON.IN|AMZN", merchant: "Amazon", category: "Shopping", subcategory: null, priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { ruleId: "r-zomato", pattern: "ZOMATO", merchant: "Zomato", category: "Food", subcategory: "Delivery", priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { ruleId: "r-swiggy", pattern: "SWIGGY", merchant: "Swiggy", category: "Food", subcategory: "Delivery", priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { ruleId: "r-rapido", pattern: "RAPIDO", merchant: "Rapido", category: "Transport", subcategory: "Cab", priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { ruleId: "r-flipkart", pattern: "FLIPKART", merchant: "Flipkart", category: "Shopping", subcategory: null, priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  { ruleId: "r-primevideo", pattern: "PRIME VIDEO", merchant: "Prime Video", category: "Subscriptions", subcategory: null, priority: 10, enabled: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
];

export const mockImportHistory: ImportRecord[] = [
  { importId: "imp-sms-001", source: "sms", startedAt: "2026-09-04T09:00:00Z", completedAt: "2026-09-04T09:00:42Z", messagesScanned: 12, transactionsDetected: 6, transactionsImported: 6, duplicates: 0, errors: 0, status: "completed" },
  { importId: "imp-gmail-001", source: "gmail", startedAt: "2026-09-01T06:00:00Z", completedAt: "2026-09-01T06:04:12Z", messagesScanned: 1284, transactionsDetected: 318, transactionsImported: 301, duplicates: 17, errors: 0, status: "completed" },
];
