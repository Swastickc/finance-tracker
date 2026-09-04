"use server";

import { getGmailImporter } from "@/lib/gmail/provider";
import type { DryRunItem } from "@/lib/gmail/types";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRateLimitKey } from "@/lib/requestIdentity";

const ACTION_LIMIT = 10;
const ACTION_WINDOW_MS = 60_000;
const MAX_BATCH_SIZE = 50;

async function assertNotRateLimited(action: string) {
  const key = `gmail:${action}:${await getRateLimitKey()}`;
  if (!checkRateLimit(key, ACTION_LIMIT, ACTION_WINDOW_MS)) {
    throw new Error("Too many Gmail import actions in a short time — please wait a moment and try again.");
  }
}

export async function scanGmailAction() {
  await assertNotRateLimited("scan");
  return getGmailImporter().scan();
}

export async function dryRunGmailAction(messageIds: string[]) {
  await assertNotRateLimited("dry-run");
  if (!Array.isArray(messageIds) || messageIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid message ID list.");
  }
  return getGmailImporter().dryRun(messageIds.slice(0, MAX_BATCH_SIZE));
}

export async function importGmailAction(items: DryRunItem[]) {
  await assertNotRateLimited("import");
  if (!Array.isArray(items)) throw new Error("Invalid import batch.");
  return getGmailImporter().importItems(items.slice(0, MAX_BATCH_SIZE));
}

