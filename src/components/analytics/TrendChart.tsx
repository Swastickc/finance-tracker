import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/cn";

interface TrendChartProps {
  points: { monthKey: string; label: string; amount: number }[];
  tone?: "accent" | "success" | "muted";
}

const TONE_CLASS = { accent: "bg-accent", success: "bg-success", muted: "bg-muted" } as const;

/** Minimal bar chart — no charting library, matches the calm/Apple-inspired visual direction. */
export function TrendChart({ points, tone = "accent" }: TrendChartProps) {
  const max = Math.max(...points.map((p) => p.amount), 1);

  return (
    <div className="flex items-end gap-2">
      {points.map((p) => {
        const heightPct = p.amount > 0 ? Math.max(4, (p.amount / max) * 100) : 2;
        return (
          <div key={p.monthKey} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="flex h-28 w-full items-end"
              role="img"
              aria-label={`${p.label}: ${formatCurrency(p.amount)}`}
            >
              <div className={cn("w-full rounded-t-md", TONE_CLASS[tone])} style={{ height: `${heightPct}%` }} />
            </div>
            <span className="text-[11px] text-muted">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ChangeLabel({ changePercent, invert = false }: { changePercent: number | null; invert?: boolean }) {
  if (changePercent === null) return <span className="text-xs text-muted">No prior data</span>;
  const isIncrease = changePercent > 0;
  const isGood = invert ? isIncrease : !isIncrease;
  return (
    <span className={cn("text-xs font-medium", isGood ? "text-success" : "text-danger")}>
      {formatPercent(changePercent)}
    </span>
  );
}
