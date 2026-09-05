// Custom Worker entry: re-uses the OpenNext-generated fetch handler and adds
// a scheduled() handler for the Cron Trigger (see wrangler.jsonc
// "triggers.crons" and https://opennext.js.org/cloudflare/howtos/custom-worker).
// @ts-expect-error ".open-next/worker.js" is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { runScheduledGmailScan, type ScheduledScanEnv } from "./src/lib/gmail/scheduledScan";

// Minimal structural types for the Workers runtime APIs we use here —
// avoids a hard dependency on @cloudflare/workers-types, matching the
// project's existing convention (see src/lib/gmail/scanState.ts).
interface MinimalExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const customWorker = {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: ScheduledScanEnv, ctx: MinimalExecutionContext) {
    ctx.waitUntil(
      runScheduledGmailScan(env).then((result) => {
        console.log("[cron] Gmail scan result:", JSON.stringify(result));
      })
    );
  },
};

export default customWorker;
