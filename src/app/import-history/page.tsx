import { getImportHistory } from "@/lib/data/transactions";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SOURCE_LABEL } from "@/lib/labels";
import { History } from "lucide-react";

export default async function ImportHistoryPage() {
  const imports = await getImportHistory();

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Import History</h1>
      {imports.length === 0 ? (
        <EmptyState icon={<History size={28} />} title="No imports yet" description="Gmail and SMS import runs will be tracked here." />
      ) : (
        <div className="space-y-3">
          {imports.map((imp) => (
            <Card key={imp.importId} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-semibold">{SOURCE_LABEL[imp.source]} Import</p>
                <Badge tone={imp.status === "completed" ? "success" : imp.status === "failed" ? "danger" : "neutral"}>
                  {imp.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {new Date(imp.startedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted">Scanned</p>
                  <p className="font-medium tabular-nums">{imp.messagesScanned.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted">Detected</p>
                  <p className="font-medium tabular-nums">{imp.transactionsDetected.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted">Imported</p>
                  <p className="font-medium tabular-nums">{imp.transactionsImported.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-muted">Duplicates</p>
                  <p className="font-medium tabular-nums">{imp.duplicates.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
