/**
 * Tracks which Gmail message IDs have already been scanned/claimed/imported
 * so incremental scans only surface genuinely new messages, and so the same
 * message can never be imported twice — across requests, Worker isolates,
 * restarts, and deployments (project-spec-truth.md §"ONGOING GMAIL").
 *
 * `D1ScanStateStore` (backed by a Cloudflare D1 database) is the persistent,
 * production implementation, chosen over Workers KV specifically because it
 * provides an atomic claim primitive (see tryClaim) — KV's get-then-put has
 * no compare-and-swap, so two concurrent requests could both observe "not
 * imported yet" and both proceed. `InMemoryScanStateStore` is a per-process
 * fallback used only when no Cloudflare Workers runtime is available (local
 * `next dev` without the OpenNext dev integration, or unit tests) — it is
 * NOT shared across isolates/restarts and must never be used in a deployed
 * Worker. `getScanStateStore()` picks the right one automatically and throws
 * rather than silently falling back if it detects it's actually running in
 * the Workers runtime with no D1 binding configured (see resolveD1Binding).
 *
 * Identity key is always the individual Gmail message `id` — never the
 * thread id (see gmail/client.ts).
 *
 * IMPORTANT — D1 and Google Sheets are NOT one atomic transaction. This
 * store can guarantee (a) an atomic pre-write claim so two concurrent
 * imports of the same message can never both proceed, and (b) that a claim
 * is never silently re-issued. It CANNOT guarantee that a Sheets append and
 * the corresponding D1 "imported" write both happen or both don't — if the
 * process dies between them, the message is left in "importing" state
 * forever unless something notices. That's what the derived "ambiguous"
 * state is for: a message stuck "importing" past AMBIGUOUS_AFTER_MS is
 * reported as "ambiguous", NEVER auto-retried and NEVER auto-marked
 * imported — only a human, checking the actual Sheet, can safely resolve it.
 */

export type MessageState = "pending" | "importing" | "imported";

/** Reported state adds "ambiguous" — a derived (not separately stored) view of a stale "importing" row. Distinguishable from all three real states so callers can't accidentally treat it as one of them. */
export type ReportedMessageState = MessageState | "ambiguous";

/** How long an "importing" claim can go unfinalized before it's reported as ambiguous instead of importing. Deliberately never used to auto-resolve anything — see module doc comment. */
export const AMBIGUOUS_AFTER_MS = 10 * 60 * 1000;

export interface ScanStateStore {
  isNewMessage(id: string): Promise<boolean>;
  /** Marks messages as seen-but-not-yet-claimed. Never touches an existing "importing"/"imported" row. */
  markPending(ids: string[]): Promise<void>;
  /**
   * Atomically transitions a message to "importing". Succeeds (true) only if
   * the message was never seen before or is still "pending". Returns false
   * for "importing" (even if stale/ambiguous — ambiguous claims are NEVER
   * automatically retried) or "imported". Concurrent calls for the same id
   * must resolve so that exactly one caller receives true.
   */
  tryClaim(id: string): Promise<boolean>;
  /** Finalizes previously-claimed ("importing") messages as "imported". Never touches ids not currently "importing". */
  markImported(ids: string[]): Promise<void>;
  getMessageState(id: string): Promise<ReportedMessageState | undefined>;
  /** Batched equivalent of calling getMessageState() per id — chunks the lookup into few round-trips instead of one per id. Ids with no recorded state are simply absent from the returned map. */
  getManyStates(ids: string[]): Promise<Map<string, ReportedMessageState>>;
}

/** Max ids per batched SQL statement (well under SQLite's default bound-parameter limit). */
const BATCH_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/** Raised whenever the state store cannot honestly answer/persist a request — callers must NOT treat this as "not processed" or "processed". */
export class ScanStatePersistenceError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = "ScanStatePersistenceError";
  }
}

/**
 * Structural subset of Cloudflare's D1Database/D1PreparedStatement we depend
 * on — avoids a hard dependency on @cloudflare/workers-types.
 */
export interface D1ResultLike {
  success: boolean;
  meta: { changes?: number };
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<D1ResultLike>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

interface StateRow {
  state: string;
  claimed_at: string | null;
}

function isKnownState(value: string): value is MessageState {
  return value === "pending" || value === "importing" || value === "imported";
}

function deriveReportedState(row: StateRow): ReportedMessageState {
  if (!isKnownState(row.state)) {
    throw new ScanStatePersistenceError(`Corrupt Gmail scan state value: ${JSON.stringify(row.state)}`);
  }
  if (row.state === "importing" && row.claimed_at) {
    const claimedAt = new Date(row.claimed_at).getTime();
    if (!Number.isNaN(claimedAt) && Date.now() - claimedAt > AMBIGUOUS_AFTER_MS) {
      return "ambiguous";
    }
  }
  return row.state;
}

/**
 * Persistent store for the Cloudflare Workers runtime, backed by D1 (a
 * single-writer SQLite database — see module doc comment for why this was
 * chosen over KV). `tryClaim` is a single atomic UPSERT: SQLite serializes
 * writes to one database, so of two concurrent claim attempts for the same
 * message, exactly one succeeds — no application-level locking needed.
 */
export class D1ScanStateStore implements ScanStateStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async isNewMessage(id: string): Promise<boolean> {
    return (await this.getMessageState(id)) === undefined;
  }

  async markPending(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const uniqueIds = [...new Set(ids)];
    await Promise.all(
      chunk(uniqueIds, BATCH_CHUNK_SIZE).map(async (idsChunk) => {
        const placeholders = idsChunk.map(() => "(?, 'pending')").join(",");
        try {
          await this.db
            .prepare(`INSERT INTO gmail_scan_state (message_id, state) VALUES ${placeholders} ON CONFLICT(message_id) DO NOTHING`)
            .bind(...idsChunk)
            .run();
        } catch (err) {
          throw new ScanStatePersistenceError(`Failed to persist Gmail scan state ("pending") for ${idsChunk.length} message(s)`, err);
        }
      })
    );
  }

  async tryClaim(id: string): Promise<boolean> {
    let result: D1ResultLike;
    try {
      result = await this.db
        .prepare(
          `INSERT INTO gmail_scan_state (message_id, state, claimed_at) VALUES (?, 'importing', ?)
           ON CONFLICT(message_id) DO UPDATE SET state = 'importing', claimed_at = excluded.claimed_at
           WHERE gmail_scan_state.state = 'pending'`
        )
        .bind(id, new Date().toISOString())
        .run();
    } catch (err) {
      throw new ScanStatePersistenceError(`Failed to claim Gmail message ${id}`, err);
    }
    return (result.meta.changes ?? 0) > 0;
  }

  async markImported(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => "?").join(",");
    try {
      await this.db
        .prepare(
          `UPDATE gmail_scan_state SET state = 'imported', imported_at = ? WHERE message_id IN (${placeholders}) AND state = 'importing'`
        )
        .bind(new Date().toISOString(), ...ids)
        .run();
    } catch (err) {
      throw new ScanStatePersistenceError(`Failed to finalize Gmail scan state ("imported") for ${ids.length} message(s)`, err);
    }
  }

  async getMessageState(id: string): Promise<ReportedMessageState | undefined> {
    let row: StateRow | null;
    try {
      row = await this.db.prepare(`SELECT state, claimed_at FROM gmail_scan_state WHERE message_id = ?`).bind(id).first<StateRow>();
    } catch (err) {
      throw new ScanStatePersistenceError(`Failed to read Gmail scan state for message ${id}`, err);
    }
    return row ? deriveReportedState(row) : undefined;
  }

  async getManyStates(ids: string[]): Promise<Map<string, ReportedMessageState>> {
    const uniqueIds = [...new Set(ids)];
    const chunkResults = await Promise.all(
      chunk(uniqueIds, BATCH_CHUNK_SIZE).map(async (idsChunk) => {
        const placeholders = idsChunk.map(() => "?").join(",");
        try {
          const { results } = await this.db
            .prepare(`SELECT message_id, state, claimed_at FROM gmail_scan_state WHERE message_id IN (${placeholders})`)
            .bind(...idsChunk)
            .all<StateRow & { message_id: string }>();
          return results;
        } catch (err) {
          throw new ScanStatePersistenceError(`Failed to batch-read Gmail scan state for ${idsChunk.length} message(s)`, err);
        }
      })
    );

    const result = new Map<string, ReportedMessageState>();
    for (const rows of chunkResults) {
      for (const row of rows) result.set(row.message_id, deriveReportedState(row));
    }
    return result;
  }
}

/** Per-process, non-persistent fallback for local dev/tests only — see module doc comment. Mirrors D1ScanStateStore's claim semantics exactly, just without real concurrency to worry about. */
export class InMemoryScanStateStore implements ScanStateStore {
  private readonly store = new Map<string, { state: MessageState; claimedAt?: number }>();

  async isNewMessage(id: string): Promise<boolean> {
    return (await this.getMessageState(id)) === undefined;
  }

  async markPending(ids: string[]): Promise<void> {
    for (const id of ids) if (!this.store.has(id)) this.store.set(id, { state: "pending" });
  }

  async tryClaim(id: string): Promise<boolean> {
    const existing = this.store.get(id);
    if (existing && existing.state !== "pending") return false;
    this.store.set(id, { state: "importing", claimedAt: Date.now() });
    return true;
  }

  async markImported(ids: string[]): Promise<void> {
    for (const id of ids) {
      const existing = this.store.get(id);
      if (existing?.state === "importing") this.store.set(id, { state: "imported" });
    }
  }

  async getMessageState(id: string): Promise<ReportedMessageState | undefined> {
    const existing = this.store.get(id);
    if (!existing) return undefined;
    return deriveReportedState({ state: existing.state, claimed_at: existing.claimedAt ? new Date(existing.claimedAt).toISOString() : null });
  }

  async getManyStates(ids: string[]): Promise<Map<string, ReportedMessageState>> {
    const result = new Map<string, ReportedMessageState>();
    for (const id of ids) {
      const state = await this.getMessageState(id);
      if (state !== undefined) result.set(id, state);
    }
    return result;
  }
}

/** Checks all IDs in a handful of batched queries and returns only the ones with no recorded state at all. */
export async function filterNewMessageIds(store: ScanStateStore, ids: string[]): Promise<string[]> {
  const states = await store.getManyStates(ids);
  return ids.filter((id) => !states.has(id));
}

/** Checks all IDs in a handful of batched queries and returns only the ones currently reported "ambiguous" (stale "importing" claim — needs manual verification, never auto-retried). */
export async function filterAmbiguousMessageIds(store: ScanStateStore, ids: string[]): Promise<string[]> {
  const states = await store.getManyStates(ids);
  return ids.filter((id) => states.get(id) === "ambiguous");
}

async function resolveD1Binding(): Promise<D1DatabaseLike | null> {
  // Deliberately typed loosely rather than against @opennextjs/cloudflare's own
  // CloudflareEnv (which references ambient Workers runtime types this repo
  // does not depend on) — we only ever read one structurally-typed property.
  let env: { GMAIL_SCAN_STATE_DB?: D1DatabaseLike };
  try {
    const cf = (await import("@opennextjs/cloudflare")) as {
      getCloudflareContext: (opts: { async: true }) => Promise<{ env: { GMAIL_SCAN_STATE_DB?: D1DatabaseLike } }>;
    };
    ({ env } = await cf.getCloudflareContext({ async: true }));
  } catch {
    // Not running inside the Cloudflare Workers runtime (local `next dev`
    // without the OpenNext dev integration, or Vitest) — safe, documented
    // fallback to in-memory state for local development/tests only.
    return null;
  }

  const binding = env.GMAIL_SCAN_STATE_DB;
  if (!binding) {
    // We ARE in the Workers runtime, so silently falling back to in-memory
    // state here would reintroduce cross-isolate duplicate imports without
    // any signal that persistence isn't actually configured. Fail loudly.
    throw new ScanStatePersistenceError(
      "Running in the Cloudflare Workers runtime but no GMAIL_SCAN_STATE_DB D1 binding is configured. " +
        "Add a d1_databases entry to wrangler.jsonc (see project docs) before importing Gmail messages."
    );
  }
  return binding;
}

let cached: ScanStateStore | null = null;

/** Resolves once per process: a D1-backed store when deployed to Workers, otherwise an in-memory fallback for local dev/tests. */
export async function getScanStateStore(): Promise<ScanStateStore> {
  if (!cached) {
    const db = await resolveD1Binding();
    cached = db ? new D1ScanStateStore(db) : new InMemoryScanStateStore();
  }
  return cached;
}

/** Test-only: clears the memoized store so the next getScanStateStore() call re-resolves it. */
export function resetScanStateStoreForTests(): void {
  cached = null;
}
