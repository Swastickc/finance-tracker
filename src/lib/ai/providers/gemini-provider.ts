import type { FinancialContext } from "@/lib/ai/context";
import { AI_SYSTEM_PROMPT, type AIProvider } from "@/lib/ai/providers/types";

const DEFAULT_MODEL = "gemini-1.5-flash";

export class GeminiProvider implements AIProvider {
  name = "gemini";

  private async complete(userPrompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set (see .env.example).");

    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  }

  generateInsight(ctx: FinancialContext) {
    return this.complete(`Context: ${JSON.stringify(ctx)}\n\nWrite a short insight about this month's spending.`);
  }

  answerQuestion(ctx: FinancialContext, question: string) {
    return this.complete(`Context: ${JSON.stringify(ctx)}\n\nQuestion: ${question}`);
  }
}
