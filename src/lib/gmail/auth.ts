// Standard OAuth2 refresh-token flow for a user's own Gmail (Gmail has no
// service-account/domain-wide-delegation option for personal inboxes, unlike
// the Sheets service account used in Phase 5). The refresh token is obtained
// once, out of band, via Google's OAuth consent screen — see .env.example.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

let cachedToken: CachedToken | null = null;

export async function getGmailAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Gmail is not configured: set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN (see .env.example)."
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Gmail auth failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}
