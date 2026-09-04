// Signed, stateless session tokens using Web Crypto (edge/Node compatible,
// consistent with the Sheets/Gmail auth in this codebase). Only active when
// APP_ACCESS_PASSWORD + SESSION_SECRET are set — see .env.example.

export const SESSION_COOKIE = "session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function base64UrlEncode(bytes: ArrayBuffer | string): string {
  const bin = typeof bytes === "string" ? bytes : String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64);
}

async function hmacSign(secret: string, data: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Digest-then-compare so differing password lengths don't leak via early return. */
export async function passwordsMatch(candidate: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(candidate)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const bytesA = new Uint8Array(a);
  const bytesB = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set (required when APP_ACCESS_PASSWORD is set — see .env.example).");

  const payload = base64UrlEncode(JSON.stringify({ exp: Date.now() + SESSION_TTL_MS }));
  const signature = base64UrlEncode(await hmacSign(secret, payload));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = base64UrlEncode(await hmacSign(secret, payload));
  if (!constantTimeEqual(signature, expectedSignature)) return false;

  try {
    const { exp } = JSON.parse(base64UrlDecode(payload)) as { exp: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
