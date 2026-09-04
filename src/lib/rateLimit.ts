// In-memory sliding-window limiter. Per-server-instance only — on multi-
// instance edge deployments (e.g. Cloudflare) each isolate has its own
// memory, so this is a best-effort guard against accidental abuse/cost
// overrun, not a distributed rate limit. A real distributed limiter would
// need Cloudflare KV/Durable Objects (out of scope here).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}
