/**
 * Tracks which Gmail message IDs have already been scanned/imported so
 * incremental scans only surface genuinely new messages (project-spec-truth.md
 * §"ONGOING GMAIL"). In-memory, per-process only — resets on restart and is
 * NOT shared across multiple server instances/edge isolates. A production
 * deployment needs persistent storage (e.g. a Cloudflare KV binding or a
 * dedicated tracking sheet/tab); no such backing store was specified, so one
 * hasn't been invented here — this is the safe, documented gap.
 */
export type MessageState = "pending" | "imported";

const store = new Map<string, MessageState>();

export function isNewMessage(id: string): boolean {
  return !store.has(id);
}

/** Marks messages as seen-but-not-yet-imported (won't be reported as "new" again, but stays revisitable). */
export function markPending(ids: string[]): void {
  for (const id of ids) if (!store.has(id)) store.set(id, "pending");
}

export function markImported(ids: string[]): void {
  for (const id of ids) store.set(id, "imported");
}

export function getMessageState(id: string): MessageState | undefined {
  return store.get(id);
}
