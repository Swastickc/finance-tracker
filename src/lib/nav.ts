import {
  BarChart3,
  CheckCircle2,
  History,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom tab bar (max 5, thumb-friendly). */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Overview", href: "/", icon: LayoutDashboard, primary: true },
  { label: "Transactions", href: "/transactions", icon: Receipt, primary: true },
  { label: "Review", href: "/review", icon: CheckCircle2, primary: true },
  { label: "Analytics", href: "/analytics", icon: BarChart3, primary: true },
  { label: "Settings", href: "/settings", icon: Settings, primary: true },
  { label: "Data Quality", href: "/data-quality", icon: ShieldCheck },
  { label: "Import History", href: "/import-history", icon: History },
];
