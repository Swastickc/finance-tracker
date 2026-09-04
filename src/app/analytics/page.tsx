import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Analytics</h1>
      <EmptyState
        icon={<BarChart3 size={28} />}
        title="Analytics are coming soon"
        description="Spending trends, category breakdowns, and merchant analysis will appear here."
      />
    </div>
  );
}
