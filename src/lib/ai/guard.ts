import type { FinancialContext } from "@/lib/ai/context";
import type { AIProvider } from "@/lib/ai/providers/types";
import { TemplateAIProvider } from "@/lib/ai/providers/template-provider";

/** Recursively collects every finite number in the context, so hallucinated figures can be spotted. */
function collectNumbers(value: unknown, out: number[]): void {
  if (typeof value === "number" && Number.isFinite(value)) {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectNumbers(v, out);
  }
}

/** Numbers a model is always allowed to say regardless of context (small counts, percentages of change already covered separately, etc). */
const ALWAYS_ALLOWED = new Set([0, 1, 2, 3, 4, 5, 100]);

/**
 * Fast, free, deterministic grounding check (PROJECT_SPEC.md §13: the LLM
 * must never be the source of arithmetic truth). Extracts every number
 * mentioned in the AI's text and rejects it unless each one is present
 * (within small rounding tolerance) in the structured context it was given —
 * catches invented amounts/percentages before they ever reach the user.
 */
export function isNumericallyGrounded(text: string, ctx: FinancialContext): boolean {
  const known: number[] = [];
  collectNumbers(ctx, known);

  const mentioned = text.match(/\d[\d,]*\.?\d*/g) ?? [];
  for (const raw of mentioned) {
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n) || ALWAYS_ALLOWED.has(n)) continue;
    const grounded = known.some((k) => Math.abs(k - n) <= Math.max(1, Math.abs(k) * 0.02));
    if (!grounded) return false;
  }
  return true;
}

/** Second-pass semantic check — literally an LLM judging the first LLM's output against the same data, as requested. Fails closed (treats errors as "not grounded"). */
async function llmJudge(inner: AIProvider, ctx: FinancialContext, text: string): Promise<boolean> {
  try {
    const verdict = await inner.answerQuestion(
      ctx,
      `Reply with exactly one word, YES or NO, nothing else. Does this statement ONLY use amounts, merchants, and categories that appear in the JSON context, without inventing or exaggerating anything? Statement: "${text.replace(/"/g, "'")}"`
    );
    return verdict.trim().toUpperCase().startsWith("YES");
  } catch {
    return false;
  }
}

/**
 * Wraps a real LLM provider so every insight is checked before the user ever
 * sees it: a deterministic number-grounding pass, then a second LLM call
 * that judges the first one's output against the same data. If either check
 * fails (or the provider errors, e.g. missing API key), falls back to the
 * deterministic template so the app always shows *something* correct
 * instead of an error or a hallucination.
 */
export class GuardedAIProvider implements AIProvider {
  private readonly inner: AIProvider;
  private readonly fallback = new TemplateAIProvider();
  private lastUsed: string;

  constructor(inner: AIProvider) {
    this.inner = inner;
    this.lastUsed = inner.name;
  }

  get name(): string {
    return this.lastUsed;
  }

  async generateInsight(ctx: FinancialContext): Promise<string> {
    try {
      const text = await this.inner.generateInsight(ctx);
      if (isNumericallyGrounded(text, ctx) && (await llmJudge(this.inner, ctx, text))) {
        this.lastUsed = this.inner.name;
        return text;
      }
      console.warn(`[ai-guard] rejected ungrounded insight from ${this.inner.name}, falling back to template`);
    } catch (err) {
      console.warn(`[ai-guard] ${this.inner.name} failed (${err instanceof Error ? err.message : err}), falling back to template`);
    }
    this.lastUsed = "template";
    return this.fallback.generateInsight(ctx);
  }

  async answerQuestion(ctx: FinancialContext, question: string): Promise<string> {
    try {
      const text = await this.inner.answerQuestion(ctx, question);
      // Skip the second LLM-judge call here — this path is interactive/latency-sensitive; the free numeric guard still catches invented figures.
      if (isNumericallyGrounded(text, ctx)) {
        this.lastUsed = this.inner.name;
        return text;
      }
      console.warn(`[ai-guard] rejected ungrounded answer from ${this.inner.name}, falling back to template`);
    } catch (err) {
      console.warn(`[ai-guard] ${this.inner.name} failed (${err instanceof Error ? err.message : err}), falling back to template`);
    }
    this.lastUsed = "template";
    return this.fallback.answerQuestion(ctx, question);
  }
}
