import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
      <Skeleton className="h-8 w-40" />
      <Card className="space-y-3 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-36" />
      </Card>
      <Card className="p-5">
        <Skeleton className="h-16 w-full" />
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
        <Skeleton className="h-20 w-full rounded-[var(--radius-card)]" />
      </div>
      <Card className="p-5">
        <Skeleton className="h-16 w-full" />
      </Card>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Card className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
