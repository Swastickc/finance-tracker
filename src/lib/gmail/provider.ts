import type { GmailImporter } from "@/lib/gmail/providers/types";
import { MockGmailImporter } from "@/lib/gmail/providers/mock-gmail-provider";
import { LiveGmailImporter } from "@/lib/gmail/providers/live-gmail-provider";

let cached: GmailImporter | null = null;

/** GMAIL_SOURCE=live opts into real Gmail API calls; anything else (default) uses fixture data. */
export function getGmailImporter(): GmailImporter {
  if (!cached) {
    cached = process.env.GMAIL_SOURCE === "live" ? new LiveGmailImporter() : new MockGmailImporter();
  }
  return cached;
}
