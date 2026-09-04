import type { FinancialContext } from "@/lib/ai/context";
import { AI_SYSTEM_PROMPT, type AIProvider } from "@/lib/ai/providers/types";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIProvider implements AIProvider {
  name = "openai";

  private async complete(userPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set (see .env.example).");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  generateInsight(ctx: FinancialContext) {
    return this.complete(`Context: ${JSON.stringify(ctx)}\n\nWrite a short insight about this month's spending.`);
  }

  answerQuestion(ctx: FinancialContext, question: string) {
    return this.complete(`Context: ${JSON.stringify(ctx)}\n\nQuestion: ${question}`);
  }
}
