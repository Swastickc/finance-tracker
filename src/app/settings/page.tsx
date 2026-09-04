import Link from "next/link";
import { ChevronRight, History, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";

const LINKS = [
  { href: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { href: "/import-history", label: "Import History", icon: History },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="px-1 text-[28px] font-semibold tracking-tight">Settings</h1>

      <section>
        <SectionHeading title="Diagnostics" />
        <Card className="divide-y divide-border">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center justify-between px-4 py-3.5">
              <span className="flex items-center gap-3 text-[15px] font-medium">
                <Icon size={19} className="text-muted" aria-hidden="true" />
                {label}
              </span>
              <ChevronRight size={18} className="text-muted" aria-hidden="true" />
            </Link>
          ))}
        </Card>
      </section>

      <section>
        <SectionHeading title="About" />
        <Card className="p-4 text-sm text-muted">
          Data sources, AI provider, and account settings will appear here in a later phase.
        </Card>
      </section>
    </div>
  );
}
