"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { askFinanceQuestionAction } from "@/lib/ai/actions";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const SAMPLE_QUESTIONS = [
  "Where did I spend the most this month?",
  "How much am I projected to spend this month?",
  "What are my biggest recurring expenses?",
];

export function AskAI() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await askFinanceQuestionAction(q);
      setAnswer(result.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
        <p className="text-sm font-semibold text-muted">Ask about your finances</p>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. How much did I spend on food?"
          aria-label="Ask a question about your finances"
          maxLength={300}
        />
        <Button type="submit" disabled={loading || !question.trim()} className="flex-shrink-0 text-sm">
          {loading ? "Asking…" : "Ask"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted"
          >
            {q}
          </button>
        ))}
      </div>

      {answer && <p className="mt-4 rounded-lg bg-surface-secondary px-3.5 py-3 text-[15px]">{answer}</p>}
    </Card>
  );
}
