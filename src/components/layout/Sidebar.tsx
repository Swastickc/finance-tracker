"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="hidden md:flex md:w-64 md:flex-none md:flex-col md:gap-1 md:border-r md:border-border md:px-3 md:py-6"
    >
      <p className="mb-4 px-3 text-[17px] font-semibold tracking-tight">Finance</p>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
              active ? "bg-accent/10 text-accent" : "text-foreground hover:bg-surface-secondary"
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
