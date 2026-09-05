import type { AIProvider } from "@/lib/ai/providers/types";
import { TemplateAIProvider } from "@/lib/ai/providers/template-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { CloudflareWorkersAIProvider } from "@/lib/ai/providers/cloudflare-provider";
import { GuardedAIProvider } from "@/lib/ai/guard";

let cached: AIProvider | null = null;

/** AI_PROVIDER=openai|gemini|cloudflare opts into a real LLM; anything else (default) uses the deterministic template.
 *  Real providers are wrapped in GuardedAIProvider, which grounds every insight against the structured metrics and
 *  falls back to the template on any hallucination/error — the app should never show an unverified claim. */
export function getAIProvider(): AIProvider {
  if (!cached) {
    switch (process.env.AI_PROVIDER) {
      case "openai":
        cached = new GuardedAIProvider(new OpenAIProvider());
        break;
      case "gemini":
        cached = new GuardedAIProvider(new GeminiProvider());
        break;
      case "cloudflare":
        cached = new GuardedAIProvider(new CloudflareWorkersAIProvider());
        break;
      default:
        cached = new TemplateAIProvider();
    }
  }
  return cached;
}
