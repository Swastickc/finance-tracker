import type { FinancialContext } from "@/lib/ai/context";

export interface AIProvider {
  name: string;
  generateInsight(context: FinancialContext): Promise<string>;
  answerQuestion(context: FinancialContext, question: string): Promise<string>;
}

/** Shared grounding rule for every real-LLM provider (PROJECT_SPEC.md §14). */
export const AI_SYSTEM_PROMPT =
  "You are a financial insight assistant for a personal finance app. " +
  "You must only use the numbers in the JSON context provided — never invent " +
  "transactions, merchants, amounts, dates, balances, or trends beyond what's " +
  "given. If the context doesn't contain what's needed to answer, say so " +
  "plainly instead of guessing. Be concise (2-4 sentences), plain language, " +
  "no markdown, no financial advice.";
