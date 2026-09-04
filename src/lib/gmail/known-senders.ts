// Known high-volume transaction senders/services from PROJECT_SPEC.md §3.
// Used to build the SCAN search query and as a hint (not proof) for merchant
// matching — never assume this list is exhaustive or that every email from
// these senders is a transaction.
export const KNOWN_TRANSACTION_SENDERS = [
  "Amazon",
  "Amazon Pay",
  "Zomato",
  "Reliance Digital",
  "Rapido",
  "Flipkart",
  "AJIO Luxe",
  "Myntra",
  "Shopify",
  "Stake",
  "Prime Video",
  "Shiprocket",
  "Ola Cabs",
  "District",
  "Xiaomi",
  "Swiggy",
  "OlaMoney",
  "Razorpay",
  "Snitch",
] as const;

/** Semantic anchors for locating an amount in free-form email text (PROJECT_SPEC.md §7). */
export const AMOUNT_ANCHORS = [
  "debited",
  "spent",
  "paid",
  "credited",
  "received",
  "transaction amount",
  "total amount",
  "refund",
] as const;

/** Gmail search query for SCAN — broad on purpose; DRY RUN does the real filtering. */
export function buildScanQuery(): string {
  const keywordQuery = AMOUNT_ANCHORS.map((k) => `"${k}"`).join(" OR ");
  return `(${keywordQuery})`;
}
