import type { FinancialContext } from "@/lib/ai/context";
import type { AIProvider } from "@/lib/ai/providers/types";

/**
 * Stubbed, not wired: Cloudflare Workers AI needs the `AI` binding, exposed
 * via `@cloudflare/next-on-pages` (or the OpenNext Cloudflare adapter). As of
 * this writing, `@cloudflare/next-on-pages` only supports Next.js <=15.5.2
 * (peer dependency conflict — verified via `npm install`), and this project
 * is on Next 16. Revisit once an adapter supports Next 16, or if the app is
 * downgraded/adapted for Cloudflare deployment (Phase 9).
 */
export class CloudflareWorkersAIProvider implements AIProvider {
  name = "cloudflare";

  async generateInsight(_ctx: FinancialContext): Promise<string> {
    void _ctx;
    throw new Error(
      "Cloudflare Workers AI isn't wired yet: no Next.js 16-compatible Cloudflare adapter is installed. Use AI_PROVIDER=template, openai, or gemini instead."
    );
  }

  async answerQuestion(_ctx: FinancialContext, _question: string): Promise<string> {
    void _ctx;
    void _question;
    throw new Error(
      "Cloudflare Workers AI isn't wired yet: no Next.js 16-compatible Cloudflare adapter is installed. Use AI_PROVIDER=template, openai, or gemini instead."
    );
  }
}
