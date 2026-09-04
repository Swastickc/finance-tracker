import type { ReactNode } from "react";

interface SectionHeadingProps {
  title: string;
  action?: ReactNode;
}

export function SectionHeading({ title, action }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-semibold text-muted">{title}</h2>
      {action}
    </div>
  );
}
