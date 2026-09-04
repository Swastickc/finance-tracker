import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-white hover:opacity-90 active:opacity-80",
  secondary: "bg-surface-secondary text-foreground hover:bg-border",
  ghost: "bg-transparent text-foreground hover:bg-surface-secondary",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
