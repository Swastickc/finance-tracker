import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getDataQualityReport } from "@/lib/data/dataQuality";
import { formatCurrency } from "@/lib/format";

export default async function DataQualityPage() {
  const report = await getDataQualityReport();

  const diagnostics = [
    {
      label: "Uncategorized transactions",
      count: report.uncategorizedCount,
      detail: report.uncategorizedCount > 0 ? formatCurrency(report.uncategorizedAmount) : undefined,
      href: "/review",
    },
    { label: "Unknown merchants", count: report.unknownMerchantCount, href: "/review" },
    { label: "Possible duplicates", count: report.possibleDuplicateCount, href: "/review" },
    { label: "Low-confidence imports", count: report.lowConfidenceCount, href: "/review" },
    { label: "Suspicious income classification", count: report.suspiciousIncomeCount, href: "/review" },
    { label: "Ignored records", count: report.ignoredCount, href: "/import-history" },
  ];

  const hasIssues = diagnostics.some((d) => d.count > 0);

  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Data Quality</h1>
      {!hasIssues ? (
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="No issues found"
          description="Uncategorized transactions, unknown merchants, duplicate candidates, and import errors will be tracked here."
        />
      ) : (
        <Card className="divide-y divide-border">
          {diagnostics.map((d) => (
            <Link key={d.label} href={d.href} className="flex items-center justify-between px-4 py-3.5">
              <div>
                <p className="text-[15px]">{d.label}</p>
                {d.detail && <p className="text-xs text-muted">{d.detail}</p>}
              </div>
              <Badge tone={d.count > 0 ? "warning" : "neutral"}>{d.count}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
