#!/usr/bin/env node
// One-time catch-up: marks every sourceMessageId already present in
// GmailImports as "imported" in D1 (needed because the bulk import script's
// D1 sync was broken on Windows — npx needs shell:true — until it was fixed;
// some rows had already been written to the sheet before the fix landed).
process.loadEnvFile?.(".env");
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const GMAIL_IMPORT_RANGE = process.env.GOOGLE_SHEETS_GMAIL_IMPORT_RANGE || "GmailImports!A:T";
const D1_DATABASE_NAME = "finance-tracker-gmail-scan-state";

function b64url(bytes) {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return Buffer.from(bin, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function pemToBuf(pem) {
  return Buffer.from(pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, ""), "base64");
}

async function fetchSheetValuesDirect(range) {
  const { GOOGLE_SHEETS_CLIENT_EMAIL, GOOGLE_SHEETS_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
  const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n");
  const key = await crypto.subtle.importKey("pkcs8", pemToBuf(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: GOOGLE_SHEETS_CLIENT_EMAIL, scope: "https://www.googleapis.com/auth/spreadsheets", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`;
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(signature)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  const { access_token } = await tokenRes.json();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?majorDimension=ROWS`, { headers: { Authorization: `Bearer ${access_token}` } });
  const data = await res.json();
  return data.values ?? [];
}

function assertSafeMessageId(id) {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`Unexpected Gmail message id format: ${id}`);
}

function runD1Sql(sql) {
  const wranglerBin = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");
  execFileSync(process.execPath, [wranglerBin, "d1", "execute", D1_DATABASE_NAME, "--remote", "--command", sql], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

const rows = await fetchSheetValuesDirect(GMAIL_IMPORT_RANGE);
const header = rows[0] ?? [];
const sourceIdCol = header.indexOf("sourceMessageId");
const ids = rows.slice(1).map((r) => r[sourceIdCol]).filter(Boolean);
console.log(`Found ${ids.length} sourceMessageId values in ${GMAIL_IMPORT_RANGE}.`);

const CHUNK = 300;
for (let i = 0; i < ids.length; i += CHUNK) {
  const chunk = ids.slice(i, i + CHUNK);
  chunk.forEach(assertSafeMessageId);
  const now = new Date().toISOString();
  const values = chunk.map((id) => `('${id}', 'imported', '${now}')`).join(",");
  const sql = `INSERT INTO gmail_scan_state (message_id, state, imported_at) VALUES ${values} ON CONFLICT(message_id) DO UPDATE SET state = 'imported', imported_at = excluded.imported_at`;
  runD1Sql(sql);
  console.log(`  synced ${Math.min(i + CHUNK, ids.length)}/${ids.length}`);
}
console.log("Done — D1 now consistent with GmailImports.");
