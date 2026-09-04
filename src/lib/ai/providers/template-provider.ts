import type { FinancialContext } from "@/lib/ai/context";
import type { AIProvider } from "@/lib/ai/providers/types";
import { formatCurrency } from "@/lib/format";

/** Deterministic, no network calls — the default provider so Finance AI always works with zero setup. */
export class TemplateAIProvider implements AIProvider {
  name = "template";

  async generateInsight(ctx: FinancialContext): Promise<string> {
    const sentences: string[] = [`You spent ${formatCurrency(ctx.totalSpend, ctx.currency)} in ${ctx.monthLabel}.`];

    if (ctx.changePercent !== null) {
      const direction = ctx.changePercent > 0 ? "up" : ctx.changePercent < 0 ? "down" : "flat";
      sentences.push(
        direction === "flat"
          ? "That's about the same as last month."
          : `That's ${direction} ${Math.abs(ctx.changePercent).toFixed(1)}% versus last month.`
      );
    }

    const topCategory = ctx.topCategories[0];
    if (topCategory) {
      sentences.push(
        `${topCategory.category} was your biggest category at ${formatCurrency(topCategory.amount, ctx.currency)}.`
      );
    }

    if (ctx.uncategorizedSpend > 0) {
      sentences.push(`${formatCurrency(ctx.uncategorizedSpend, ctx.currency)} is still uncategorized and needs review.`);
    }

    return sentences.join(" ");
  }

  async answerQuestion(ctx: FinancialContext, question: string): Promise<string> {
    void question;
    const insight = await this.generateInsight(ctx);
    return `No AI provider is connected yet (set AI_PROVIDER + an API key — see .env.example), so I can only share your current snapshot: ${insight}`;
  }
}
