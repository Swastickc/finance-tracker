"use server";

import { buildFinancialContext } from "@/lib/ai/context";
import { getAIProvider } from "@/lib/ai/provider";

export async function getFinanceInsightAction(): Promise<{ insight: string; provider: string; error?: string }> {
  const context = await buildFinancialContext();
  const provider = getAIProvider();
  try {
    const insight = await provider.generateInsight(context);
    return { insight, provider: provider.name };
  } catch (err) {
    return {
      insight: "AI insight isn't available right now.",
      provider: provider.name,
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}

export async function askFinanceQuestionAction(
  question: string
): Promise<{ answer: string; provider: string; error?: string }> {
  const trimmed = question.trim();
  if (!trimmed) return { answer: "Ask a question about your spending, income, or categories.", provider: "" };

  const context = await buildFinancialContext();
  const provider = getAIProvider();
  try {
    const answer = await provider.answerQuestion(context, trimmed);
    return { answer, provider: provider.name };
  } catch (err) {
    return {
      answer: "I couldn't reach the AI provider just now.",
      provider: provider.name,
      error: err instanceof Error ? err.message : "Unknown error.",
    };
  }
}
