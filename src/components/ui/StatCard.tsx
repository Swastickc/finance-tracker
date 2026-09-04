import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  delta?: { label: string; positive: boolean };
  footnote?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, footnote, className }: StatCardProps) {
  return (
    <Card className={cn("p-5", className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-[34px] font-semibold tracking-tight tabular-nums">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            delta.positive ? "text-danger" : "text-success"
          )}
        >
          {delta.label}
        </p>
      )}
      {footnote}
    </Card>
  );
}
