import { beforeEach, describe, expect, it } from "vitest";
import {
  AMBIGUOUS_AFTER_MS,
  D1ScanStateStore,
  InMemoryScanStateStore,
  ScanStatePersistenceError,
  filterAmbiguousMessageIds,
  filterNewMessageIds,
  getScanStateStore,
  resetScanStateStoreForTests,
  type D1DatabaseLike,
  type D1PreparedStatementLike,
  type D1ResultLike,
  type ScanStateStore,
} from "@/lib/gmail/scanState";

/**
 * Minimal, deterministic stand-in for a real Cloudflare D1 database — just
 * enough SQL semantics (INSERT ... ON CONFLICT DO UPDATE ... WHERE, plain
 * INSERT ... ON CONFLICT DO NOTHING, UPDATE ... WHERE state = 'importing',
 * SELECT by primary key) to exercise D1ScanStateStore's exact queries.
 * Shared by reference across multiple `D1ScanStateStore` instances to
 * simulate persistence that outlives any single object/process/isolate.
 * Failure injection lets us test the "fails safely" requirement without
 * touching any real infrastructure.
 */
class FakeD1 implements D1DatabaseLike {
  private readonly rows = new Map<string, { state: string; claimed_at: string | null; imported_at: string | null }>();
  failNext = false;

  prepare(query: string): D1PreparedStatementLike {
    return new FakeStatement(this.rows, query, () => {
      if (this.failNext) {
        this.failNext = false;
        throw new Error("simulated D1 failure");
      }
    });
  }

  /** Test-only escape hatch to plant a raw, possibly-corrupt row directly. */
  setRaw(messageId: string, state: string, claimedAt: string | null = null): void {
    this.rows.set(messageId, { state, claimed_at: claimedAt, imported_at: null });
  }
}

class FakeStatement implements D1PreparedStatementLike {
  private args: unknown[] = [];

  constructor(
    private readonly rows: Map<string, { state: string; claimed_at: string | null; imported_at: string | null }>,
    private readonly query: string,
    private readonly maybeFail: () => void
  ) {}

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.args = values;
    return this;
  }

  async run(): Promise<D1ResultLike> {
    this.maybeFail();
    const q = this.query;

    if (q.includes("VALUES (?, 'pending')")) {
      const [id] = this.args as [string];
      if (this.rows.has(id)) return { success: true, meta: { changes: 0 } };
      this.rows.set(id, { state: "pending", claimed_at: null, imported_at: null });
      return { success: true, meta: { changes: 1 } };
    }

    if (q.includes("VALUES (?, 'importing', ?)")) {
      const [id, claimedAt] = this.args as [string, string];
      const existing = this.rows.get(id);
      if (!existing) {
        this.rows.set(id, { state: "importing", claimed_at: claimedAt, imported_at: null });
        return { success: true, meta: { changes: 1 } };
      }
      if (existing.state === "pending") {
        this.rows.set(id, { ...existing, state: "importing", claimed_at: claimedAt });
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    }

    if (q.startsWith("UPDATE gmail_scan_state SET state = 'imported'")) {
      const [importedAt, ...ids] = this.args as [string, ...string[]];
      let changes = 0;
      for (const id of ids) {
        const existing = this.rows.get(id);
        if (existing?.state === "importing") {
          this.rows.set(id, { ...existing, state: "imported", imported_at: importedAt });
          changes++;
        }
      }
      return { success: true, meta: { changes } };
    }

    throw new Error(`FakeD1: unrecognized query: ${q}`);
  }

  async first<T>(): Promise<T | null> {
    this.maybeFail();
    const [id] = this.args as [string];
    const row = this.rows.get(id);
    return (row ?? null) as T | null;
  }
}

describe("D1ScanStateStore", () => {
  it("1. a processed message remains processed after a new state instance is created", async () => {
    const fakeDb = new FakeD1();
    const storeA = new D1ScanStateStore(fakeDb);
    expect(await storeA.tryClaim("msg-1")).toBe(true);
    await storeA.markImported(["msg-1"]);

    // Brand-new object (simulates a new request/isolate) over the SAME backing database.
    const storeB = new D1ScanStateStore(fakeDb);
    expect(await storeB.getMessageState("msg-1")).toBe("imported");
    expect(await storeB.isNewMessage("msg-1")).toBe(false);
  });

  it("2. an unprocessed message is recognized as new", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    expect(await store.isNewMessage("never-seen")).toBe(true);
    expect(await store.getMessageState("never-seen")).toBeUndefined();
  });

  it("two concurrent tryClaim() calls for the same message: exactly one succeeds", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    const results = await Promise.all([store.tryClaim("race"), store.tryClaim("race")]);
    expect(results.filter(Boolean).length).toBe(1);
    expect(await store.getMessageState("race")).toBe("importing");
  });

  it("an already-imported message cannot be claimed", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    await store.tryClaim("done");
    await store.markImported(["done"]);
    expect(await store.tryClaim("done")).toBe(false);
    expect(await store.getMessageState("done")).toBe("imported");
  });

  it("an already-importing message cannot be claimed", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    expect(await store.tryClaim("inflight")).toBe(true);
    expect(await store.tryClaim("inflight")).toBe(false);
    expect(await store.getMessageState("inflight")).toBe("importing");
  });

  it("a stale importing message becomes ambiguous/reviewable, and remains unclaimable (never automatically retried)", async () => {
    const fakeDb = new FakeD1();
    const staleClaimedAt = new Date(Date.now() - AMBIGUOUS_AFTER_MS - 1000).toISOString();
    fakeDb.setRaw("stuck", "importing", staleClaimedAt);
    const store = new D1ScanStateStore(fakeDb);

    expect(await store.getMessageState("stuck")).toBe("ambiguous");
    expect(await store.isNewMessage("stuck")).toBe(false);
    // Ambiguous is still physically "importing" underneath, so a claim attempt must still fail.
    expect(await store.tryClaim("stuck")).toBe(false);
    expect(await store.getMessageState("stuck")).toBe("ambiguous");
  });

  it("successful Sheets write followed by successful D1 finalization moves importing -> imported", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    await store.tryClaim("ok");
    // Simulates: appendSheetValues() resolved, then markImported() is called.
    await store.markImported(["ok"]);
    expect(await store.getMessageState("ok")).toBe("imported");
  });

  it("Sheets failure (claim never finalized) does not mark the message imported", async () => {
    const store = new D1ScanStateStore(new FakeD1());
    await store.tryClaim("append-failed");
    // Simulates: appendSheetValues() threw, so markImported() is never called.
    expect(await store.getMessageState("append-failed")).toBe("importing");
  });

  it("persistence failure after Sheets success results in ambiguous state/review, never automatic retry", async () => {
    const fakeDb = new FakeD1();
    const store = new D1ScanStateStore(fakeDb);
    await store.tryClaim("finalize-failed");

    fakeDb.failNext = true;
    await expect(store.markImported(["finalize-failed"])).rejects.toBeInstanceOf(ScanStatePersistenceError);

    // Still "importing" right after the failure (not yet stale)...
    expect(await store.getMessageState("finalize-failed")).toBe("importing");
    // ...and once its claim is old enough, it surfaces as ambiguous, never auto-imported.
    const staleClaimedAt = new Date(Date.now() - AMBIGUOUS_AFTER_MS - 1000).toISOString();
    fakeDb.setRaw("finalize-failed", "importing", staleClaimedAt);
    expect(await store.getMessageState("finalize-failed")).toBe("ambiguous");
    expect(await store.tryClaim("finalize-failed")).toBe(false);
  });

  it("a read failure fails safely — rejects rather than claiming new or processed", async () => {
    const fakeDb = new FakeD1();
    const store = new D1ScanStateStore(fakeDb);
    fakeDb.failNext = true;
    await expect(store.isNewMessage("msg-x")).rejects.toBeInstanceOf(ScanStatePersistenceError);
  });

  it("a claim failure fails safely — rejects rather than silently succeeding or failing", async () => {
    const fakeDb = new FakeD1();
    const store = new D1ScanStateStore(fakeDb);
    fakeDb.failNext = true;
    await expect(store.tryClaim("msg-y")).rejects.toBeInstanceOf(ScanStatePersistenceError);
  });

  it("a corrupt stored value fails safely instead of being coerced into a valid state", async () => {
    const fakeDb = new FakeD1();
    fakeDb.setRaw("msg-z", "not-a-real-state");
    const store = new D1ScanStateStore(fakeDb);
    await expect(store.getMessageState("msg-z")).rejects.toBeInstanceOf(ScanStatePersistenceError);
  });
});

describe("InMemoryScanStateStore", () => {
  it("recognizes new vs. claimed vs. imported messages, and prevents re-claiming", async () => {
    const store = new InMemoryScanStateStore();
    expect(await store.isNewMessage("m")).toBe(true);
    expect(await store.tryClaim("m")).toBe(true);
    expect(await store.tryClaim("m")).toBe(false);
    await store.markImported(["m"]);
    expect(await store.getMessageState("m")).toBe("imported");
    expect(await store.tryClaim("m")).toBe(false);
  });

  it("never lets markPending touch an importing/imported message", async () => {
    const store = new InMemoryScanStateStore();
    await store.tryClaim("m");
    await store.markPending(["m"]);
    expect(await store.getMessageState("m")).toBe("importing");
  });
});

describe("filterNewMessageIds / filterAmbiguousMessageIds", () => {
  it("filterNewMessageIds excludes pending/importing/imported ids", async () => {
    const store = new InMemoryScanStateStore();
    await store.markPending(["seen-pending"]);
    await store.tryClaim("seen-importing");
    await store.tryClaim("seen-imported");
    await store.markImported(["seen-imported"]);

    const result = await filterNewMessageIds(store, ["seen-pending", "seen-importing", "seen-imported", "new-1"]);
    expect(result).toEqual(["new-1"]);
  });

  it("filterAmbiguousMessageIds only returns stale importing ids", async () => {
    const fakeDb = new FakeD1();
    const staleClaimedAt = new Date(Date.now() - AMBIGUOUS_AFTER_MS - 1000).toISOString();
    fakeDb.setRaw("stuck-1", "importing", staleClaimedAt);
    fakeDb.setRaw("fresh-importing", "importing", new Date().toISOString());
    fakeDb.setRaw("done", "imported");
    const store: ScanStateStore = new D1ScanStateStore(fakeDb);

    const result = await filterAmbiguousMessageIds(store, ["stuck-1", "fresh-importing", "done", "never-seen"]);
    expect(result).toEqual(["stuck-1"]);
  });
});

describe("getScanStateStore", () => {
  beforeEach(() => {
    resetScanStateStoreForTests();
  });

  it("falls back to an in-memory store when no Cloudflare Workers context is available (e.g. tests)", async () => {
    const store = await getScanStateStore();
    expect(store).toBeInstanceOf(InMemoryScanStateStore);
  });

  it("memoizes the resolved store across calls within the same process", async () => {
    const first = await getScanStateStore();
    const second = await getScanStateStore();
    expect(first).toBe(second);
  });
});
