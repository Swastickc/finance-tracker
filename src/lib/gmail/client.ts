import { getGmailAccessToken } from "@/lib/gmail/auth";
import type { GmailMessageMeta } from "@/lib/gmail/types";

const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

async function gmailFetch(path: string): Promise<unknown> {
  const token = await getGmailAccessToken();
  const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`Gmail API request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

interface ListMessagesResponse {
  // Gmail also returns `threadId` per entry, which we deliberately never
  // read/store — a thread can bundle multiple distinct emails together, so
  // using it as a transaction identity would silently collapse separate
  // transactions. Only the individual message `.id` is used anywhere.
  messages?: { id: string }[];
  nextPageToken?: string;
}

/** Lists message IDs matching a Gmail search query, up to `maxResults`. */
export async function listMessageIds(query: string, maxResults = 200): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: query, maxResults: String(Math.min(100, maxResults - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const data = (await gmailFetch(`/messages?${params.toString()}`)) as ListMessagesResponse;
    ids.push(...(data.messages ?? []).map((m) => m.id));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.length < maxResults);

  return ids;
}

/** Lightweight metadata-only fetch (headers only, no body) — used by SCAN to stay fast. */
export async function getMessageMetadata(id: string): Promise<GmailMessageMeta> {
  const params = new URLSearchParams({ format: "metadata" });
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "Date");
  const data = (await gmailFetch(`/messages/${id}?${params.toString()}`)) as GmailMessageResponse;
  const header = (name: string) => data.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  return { id: data.id, from: header("From"), subject: header("Subject"), date: header("Date"), snippet: data.snippet };
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

interface GmailMessageResponse {
  id: string;
  internalDate: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType?: string;
    body?: { data?: string };
    parts?: GmailPart[];
  };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function extractPlainText(part: GmailPart | GmailMessageResponse["payload"]): string {
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const text = extractPlainText(child);
    if (text) return text;
  }
  // Fall back to the first available body (e.g. text/html) if no plain-text part exists.
  if (part.body?.data) return decodeBase64Url(part.body.data);
  return "";
}

export interface GmailMessage extends GmailMessageMeta {
  body: string;
}

export async function getMessage(id: string): Promise<GmailMessage> {
  const data = (await gmailFetch(`/messages/${id}?format=full`)) as GmailMessageResponse;
  const header = (name: string) => data.payload.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  return {
    id: data.id,
    from: header("From"),
    subject: header("Subject"),
    date: header("Date"),
    snippet: data.snippet,
    body: extractPlainText(data.payload),
  };
}
