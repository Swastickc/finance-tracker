#!/usr/bin/env node
// Standalone sanity check: confirms the Sheets service account can reach the
// spreadsheet. Uses metadata-only endpoint (no cell/transaction data is
// fetched or printed) so no personal financial data ever touches this output.

process.loadEnvFile?.(".env");

const { GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
  console.error("Missing GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY / GOOGLE_SHEETS_SPREADSHEET_ID in .env");
  process.exit(1);
}

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
console.log("Service account access token obtained OK.");

const metaRes = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}?fields=properties.title,sheets.properties.title`,
  { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
);
const metaData = await metaRes.json();
if (!metaRes.ok) {
  console.error("Spreadsheet metadata fetch failed:", metaData);
  process.exit(1);
}
console.log(`Connected to spreadsheet: "${metaData.properties.title}"`);
console.log("Tabs found:", metaData.sheets.map((s) => s.properties.title).join(", "));
