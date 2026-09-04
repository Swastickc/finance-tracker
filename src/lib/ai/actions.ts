"use server";

import { buildFinancialContext } from "@/lib/ai/context";
import { getAIProvider } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rateLimit";
import { getRateLimitKey } from "@/lib/requestIdentity";

const MAX_QUESTION_LENGTH = 300;
const ASK_LIMIT = 10;
const ASK_WINDOW_MS = 60_000;

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
  if (typeof question !== "string") {
    return { answer: "Ask a question about your spending, income, or categories.", provider: "" };
  }
  const trimmed = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!trimmed) return { answer: "Ask a question about your spending, income, or categories.", provider: "" };

  const rateLimitKey = `ask:${await getRateLimitKey()}`;
  if (!checkRateLimit(rateLimitKey, ASK_LIMIT, ASK_WINDOW_MS)) {
    return { answer: "Too many questions in a short time — please wait a moment and try again.", provider: "" };
  }

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

