import type { AIProvider } from "@/lib/ai/providers/types";
import { TemplateAIProvider } from "@/lib/ai/providers/template-provider";
import { OpenAIProvider } from "@/lib/ai/providers/openai-provider";
import { GeminiProvider } from "@/lib/ai/providers/gemini-provider";
import { CloudflareWorkersAIProvider } from "@/lib/ai/providers/cloudflare-provider";

let cached: AIProvider | null = null;

/** AI_PROVIDER=openai|gemini|cloudflare opts into a real LLM; anything else (default) uses the deterministic template. */
export function getAIProvider(): AIProvider {
  if (!cached) {
    switch (process.env.AI_PROVIDER) {
      case "openai":
        cached = new OpenAIProvider();
        break;
      case "gemini":
        cached = new GeminiProvider();
        break;
      case "cloudflare":
        cached = new CloudflareWorkersAIProvider();
        break;
      default:
        cached = new TemplateAIProvider();
    }
  }
  return cached;
}
