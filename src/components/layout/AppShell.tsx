import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          id="main-content"
          className="mx-auto w-full max-w-3xl flex-1 px-4 pt-[calc(var(--safe-top)+1.5rem)] pb-24 sm:px-6 md:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
