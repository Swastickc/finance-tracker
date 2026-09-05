#!/usr/bin/env node
// Read-only row-count check for BankImports/GmailImports (no cell content printed).
process.loadEnvFile?.(".env");
const { GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;

function b64url(bytes) {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBuf(pem) {
  return Buffer.from(pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, ""), "base64");
}
const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n");
const key = await crypto.subtle.importKey("pkcs8", pemToBuf(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
const now = Math.floor(Date.now() / 1000);
const h = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const c = b64url(JSON.stringify({ iss: GOOGLE_SHEETS_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
const unsigned = `${h}.${c}`;
const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
const jwt = `${unsigned}.${b64url(sig)}`;
const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
const { access_token } = await tokenRes.json();
const base = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}`;
for (const tab of ["BankImports", "GmailImports"]) {
  const res = await fetch(`${base}/values/${encodeURIComponent(`${tab}!A:A`)}`, { headers: { Authorization: `Bearer ${access_token}` } });
  const data = await res.json();
  const rowCount = (data.values ?? []).length;
  console.log(`${tab}: ${rowCount} rows (including header) => ${Math.max(rowCount - 1, 0)} data rows`);
}
