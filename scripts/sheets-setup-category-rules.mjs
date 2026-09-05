#!/usr/bin/env node
// One-time setup: creates the "CategoryRules" tab (canonical header row) in
// the existing spreadsheet, and seeds it with default merchant->category
// rules (PROJECT_SPEC.md §12). Additive only — never touches Sheet1 (the
// existing SMS tab). Safe to re-run: skips tab creation if it already
// exists, and skips seeding if the tab already has any data rows.

process.loadEnvFile?.(".env");

const { GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
  console.error("Missing GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID in .env");
  process.exit(1);
}

// Must match src/lib/canonical/categoryRuleSchema.ts CATEGORY_RULE_HEADERS exactly.
const CATEGORY_RULE_HEADERS = ["ruleId", "pattern", "merchant", "category", "subcategory", "priority", "enabled", "createdAt", "updatedAt"];
const TAB_NAME = "CategoryRules";

// Same merchant->category mappings already used by the Gmail parser
// (src/lib/gmail/parse.ts MERCHANT_CATEGORY), now made editable/extensible
// via the Review UI + this rules engine instead of being hardcoded.
const DEFAULT_RULES = [
  ["AMAZON\\.IN|AMZN", "Amazon", "Shopping", null],
  ["AMAZON PAY", "Amazon Pay", "Shopping", null],
  ["ZOMATO", "Zomato", "Food", "Delivery"],
  ["SWIGGY", "Swiggy", "Food", "Delivery"],
  ["RAPIDO", "Rapido", "Transport", "Cab"],
  ["FLIPKART", "Flipkart", "Shopping", null],
  ["RELIANCE DIGITAL", "Reliance Digital", "Shopping", null],
  ["AJIO", "AJIO Luxe", "Shopping", "Clothing"],
  ["MYNTRA", "Myntra", "Shopping", "Clothing"],
  ["PRIME VIDEO", "Prime Video", "Subscriptions", null],
  ["OLA\\s*CABS|OLAMONEY", "Ola Cabs", "Transport", "Cab"],
  ["XIAOMI|MI\\.COM", "Xiaomi", "Shopping", null],
  ["SNITCH", "Snitch", "Shopping", "Clothing"],
  ["NETFLIX", "Netflix", "Subscriptions", null],
  ["SPOTIFY", "Spotify", "Subscriptions", null],
  ["HOTSTAR|JIOCINEMA", "Streaming", "Subscriptions", null],
  ["UBER", "Uber", "Transport", "Cab"],
  ["IRCTC", "IRCTC", "Travel", null],
  ["BIGBASKET|BLINKIT|ZEPTO|INSTAMART", "Grocery delivery", "Food", "Groceries"],
  ["PHARMEASY|1MG|NETMEDS|APOLLO", "Pharmacy", "Health", null],
];

function base64UrlEncode(bytes) {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  return Buffer.from(base64, "base64");
}

const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n");
const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
const now = Math.floor(Date.now() / 1000);
const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claims = base64UrlEncode(
  JSON.stringify({
    iss: GOOGLE_SHEETS_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
);
const unsigned = `${header}.${claims}`;
const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
});
const tokenData = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("Service account auth failed:", tokenData);
  process.exit(1);
}
const accessToken = tokenData.access_token;
const authHeader = { Authorization: `Bearer ${accessToken}` };
const base = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}`;

const metaRes = await fetch(`${base}?fields=sheets.properties.title`, { headers: authHeader });
const metaData = await metaRes.json();
if (!metaRes.ok) {
  console.error("Spreadsheet metadata fetch failed:", metaData);
  process.exit(1);
}
const existingTitles = new Set(metaData.sheets.map((s) => s.properties.title));

if (!existingTitles.has(TAB_NAME)) {
  const addRes = await fetch(`${base}:batchUpdate`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB_NAME } } }] }),
  });
  const addData = await addRes.json();
  if (!addRes.ok) {
    console.error("Failed to create tab:", addData);
    process.exit(1);
  }
  console.log(`Created tab: ${TAB_NAME}`);
} else {
  console.log(`${TAB_NAME} already exists — skipping creation.`);
}

const readRes = await fetch(`${base}/values/${encodeURIComponent(`${TAB_NAME}!A1:A1`)}`, { headers: authHeader });
const readData = await readRes.json();
if (!readRes.ok) {
  console.error(`Failed to read ${TAB_NAME}:`, readData);
  process.exit(1);
}

if ((readData.values ?? []).length > 0) {
  console.log(`${TAB_NAME} already has a header row — skipping header + seed rows.`);
} else {
  const nowIso = new Date().toISOString();
  const seedRows = DEFAULT_RULES.map(([pattern, merchant, category, subcategory], i) => [
    `r-seed-${i + 1}`,
    pattern,
    merchant,
    category,
    subcategory ?? "",
    10,
    true,
    nowIso,
    nowIso,
  ]);

  const appendRes = await fetch(
    `${base}/values/${encodeURIComponent(`${TAB_NAME}!A1`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [CATEGORY_RULE_HEADERS, ...seedRows] }),
    }
  );
  const appendData = await appendRes.json();
  if (!appendRes.ok) {
    console.error(`Failed to write header + seed rows for ${TAB_NAME}:`, appendData);
    process.exit(1);
  }
  console.log(`Header row + ${seedRows.length} default rules written to ${TAB_NAME}.`);
}

console.log("\nDone. Sheet1 (SMS tab) was not touched.");
