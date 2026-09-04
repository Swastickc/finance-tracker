import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function DataQualityPage() {
  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Data Quality</h1>
      <EmptyState
        icon={<ShieldCheck size={28} />}
        title="No issues to show yet"
        description="Uncategorized transactions, unknown merchants, duplicate candidates, and import errors will be tracked here."
      />
    </div>
  );
}
