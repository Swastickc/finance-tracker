"use server";

import { getGmailImporter } from "@/lib/gmail/provider";
import type { DryRunItem } from "@/lib/gmail/types";

export async function scanGmailAction() {
  return getGmailImporter().scan();
}

export async function dryRunGmailAction(messageIds: string[]) {
  return getGmailImporter().dryRun(messageIds);
}

export async function importGmailAction(items: DryRunItem[]) {
  return getGmailImporter().importItems(items);
}
