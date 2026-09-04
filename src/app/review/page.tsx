import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Review</h1>
      <EmptyState
        icon={<CheckCircle2 size={28} />}
        title="Nothing to review yet"
        description="Unknown merchants, low-confidence imports, and possible duplicates will show up here for quick confirmation."
      />
    </div>
  );
}
