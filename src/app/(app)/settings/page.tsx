import Link from "next/link";
import { ChevronRight, History, LogOut, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { logoutAction } from "@/lib/auth/actions";

const LINKS = [
  { href: "/data-quality", label: "Data Quality", icon: ShieldCheck },
  { href: "/import-history", label: "Import History", icon: History },
];

export default function SettingsPage() {
  const authEnabled = Boolean(process.env.APP_ACCESS_PASSWORD);

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

      {authEnabled && (
        <section>
          <SectionHeading title="Account" />
          <form action={logoutAction}>
            <Button type="submit" variant="secondary" className="w-full">
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
