#!/usr/bin/env node
// Pushes required .env values to Cloudflare as Worker secrets (deployed
// Workers don't read local .env — see opennextjs-cloudflare env-vars docs).
// Values are piped directly into wrangler's stdin, never printed anywhere.
process.loadEnvFile?.(".env");
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SECRET_KEYS = [
  "APP_ACCESS_PASSWORD",
  "SESSION_SECRET",
  "DATA_SOURCE",
  "GOOGLE_SHEETS_CLIENT_EMAIL",
  "GOOGLE_SHEETS_PRIVATE_KEY",
  "GOOGLE_SHEETS_SPREADSHEET_ID",
  "GOOGLE_SHEETS_TRANSACTIONS_RANGE",
  "GOOGLE_SHEETS_GMAIL_IMPORT_RANGE",
  "GOOGLE_SHEETS_BANK_IMPORT_RANGE",
  "GMAIL_SOURCE",
  "GMAIL_CLIENT_ID",
  "GMAIL_CLIENT_SECRET",
  "GMAIL_REFRESH_TOKEN",
  "AI_PROVIDER",
];

const wranglerBin = join(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js");

for (const key of SECRET_KEYS) {
  const value = process.env[key];
  if (!value) {
    console.log(`skip ${key} (not set locally)`);
    continue;
  }
  try {
    execFileSync(process.execPath, [wranglerBin, "secret", "put", key], {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    console.log(`ok   ${key}`);
  } catch (err) {
    console.error(`FAIL ${key}:`, err instanceof Error ? err.message.split("\n")[0] : err);
  }
}
