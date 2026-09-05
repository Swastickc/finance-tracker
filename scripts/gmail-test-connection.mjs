#!/usr/bin/env node
// Standalone sanity check: exchanges the refresh token for an access token
// and lists a couple of message IDs, without touching D1/Sheets/the app.

process.loadEnvFile?.(".env");

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
  console.error("Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN in .env");
  process.exit(1);
}

const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    client_id: GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    refresh_token: GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token",
  }),
});
const tokenData = await tokenRes.json();
if (!tokenRes.ok) {
  console.error("Token refresh failed:", tokenData);
  process.exit(1);
}
console.log("Access token obtained OK, expires in", tokenData.expires_in, "seconds");

const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=3", {
  headers: { Authorization: `Bearer ${tokenData.access_token}` },
});
const listData = await listRes.json();
if (!listRes.ok) {
  console.error("Message list failed:", listData);
  process.exit(1);
}
console.log(`Found ${listData.resultSizeEstimate ?? 0} messages (showing up to 3 IDs):`, listData.messages ?? []);
