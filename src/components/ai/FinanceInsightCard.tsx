import { Sparkles } from "lucide-react";
import { getFinanceInsightAction } from "@/lib/ai/actions";
import { Card } from "@/components/ui/Card";

export async function FinanceInsightCard() {
  const { insight } = await getFinanceInsightAction();

  return (
    <Card className="flex items-start gap-3 p-5">
      <Sparkles className="mt-0.5 flex-shrink-0 text-accent" size={20} aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-muted">AI insight</p>
        <p className="mt-1 text-[15px]">{insight}</p>
      </div>
    </Card>
  );
}
