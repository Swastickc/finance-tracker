#!/usr/bin/env node
// One-time setup: creates the "BankImports" and "GmailImports" tabs (with the
// canonical header row) in the existing spreadsheet. Additive only — never
// touches Sheet1 (the existing SMS tab). Safe to re-run; skips tabs that
// already exist.

process.loadEnvFile?.(".env");

const { GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
  console.error("Missing GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID in .env");
  process.exit(1);
}

// Must match src/lib/canonical/sheetSchema.ts CANONICAL_HEADERS exactly.
const CANONICAL_HEADERS = [
  "id", "transactionDate", "transactionTime", "amount", "currency", "type", "merchant",
  "rawDescription", "category", "subcategory", "account", "paymentMethod", "source",
  "sourceMessageId", "status", "confidence", "isRecurring", "ruleId", "classificationNote",
  "createdAt", "updatedAt",
];
const TABS_TO_CREATE = ["BankImports", "GmailImports"];

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

const tabsToAdd = TABS_TO_CREATE.filter((title) => !existingTitles.has(title));
if (tabsToAdd.length > 0) {
  const addRes = await fetch(`${base}:batchUpdate`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: tabsToAdd.map((title) => ({ addSheet: { properties: { title } } })),
    }),
  });
  const addData = await addRes.json();
  if (!addRes.ok) {
    console.error("Failed to create tabs:", addData);
    process.exit(1);
  }
  console.log("Created tabs:", tabsToAdd.join(", "));
} else {
  console.log("Both tabs already exist — skipping creation.");
}

for (const title of TABS_TO_CREATE) {
  const readRes = await fetch(`${base}/values/${encodeURIComponent(`${title}!A1:A1`)}`, { headers: authHeader });
  const readData = await readRes.json();
  if (!readRes.ok) {
    console.error(`Failed to read ${title}:`, readData);
    process.exit(1);
  }
  if ((readData.values ?? []).length > 0) {
    console.log(`${title} already has a header row — skipping.`);
    continue;
  }

  const appendRes = await fetch(
    `${base}/values/${encodeURIComponent(`${title}!A1`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [CANONICAL_HEADERS] }),
    }
  );
  const appendData = await appendRes.json();
  if (!appendRes.ok) {
    console.error(`Failed to write header row for ${title}:`, appendData);
    process.exit(1);
  }
  console.log(`Header row written to ${title}.`);
}

console.log("\nDone. Sheet1 (SMS tab) was not touched.");
