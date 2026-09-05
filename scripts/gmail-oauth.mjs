#!/usr/bin/env node
// One-time local OAuth flow to obtain a Gmail refresh token for a personal
// inbox (Gmail has no service-account option). Reads GMAIL_CLIENT_ID /
// GMAIL_CLIENT_SECRET from .env, runs a loopback HTTP server to catch the
// redirect (RFC 8252 desktop-app flow — no redirect URI needs to be
// registered in Google Cloud Console for "Desktop app" clients), exchanges
// the auth code for a refresh token, and writes it straight into .env.
// Nothing is ever printed anywhere except this machine's terminal.

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { exec } from "node:child_process";

process.loadEnvFile?.(".env");

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET in .env — fill those in first, then re-run this script.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent"); // force refresh_token even on repeat runs

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end();
    return;
  }

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" }).end(`<h2>Google returned an error: ${error}</h2>You can close this tab.`);
    console.error(`OAuth error from Google: ${error}`);
    server.close();
    process.exit(1);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await tokenResponse.json();
    if (!tokenResponse.ok || !data.refresh_token) {
      throw new Error(data.error_description ?? data.error ?? "no refresh_token in response");
    }

    updateEnvFile("GMAIL_REFRESH_TOKEN", data.refresh_token);
    res.writeHead(200, { "Content-Type": "text/html" }).end(
      "<h2>Success — refresh token saved to .env</h2>You can close this tab and return to the terminal."
    );
    console.log("\nSaved GMAIL_REFRESH_TOKEN to .env. Set GMAIL_SOURCE=live in .env when you're ready to use it.\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" }).end("<h2>Token exchange failed</h2>Check the terminal for details.");
    console.error("Token exchange failed:", err.message);
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 250);
  }
});

function updateEnvFile(key, value) {
  const envPath = ".env";
  const lines = existsSync(envPath) ? readFileSync(envPath, "utf8").split("\n") : [];
  const pattern = new RegExp(`^${key}=`);
  const idx = lines.findIndex((line) => pattern.test(line));
  const newLine = `${key}=${value}`;
  if (idx >= 0) lines[idx] = newLine;
  else lines.push(newLine);
  writeFileSync(envPath, lines.join("\n"));
}

server.listen(PORT, () => {
  console.log(`Opening browser for Google consent...\nIf it doesn't open automatically, visit:\n${authUrl.toString()}\n`);
  const opener = process.platform === "win32" ? `start "" "${authUrl}"` : process.platform === "darwin" ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
  exec(opener);
});
