import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "brand" | "success" | "warning" | "danger" | "info" | "outline";

const styles: Record<Variant, string> = {
  default: "bg-[var(--color-bg-elev-2)] text-[var(--color-fg-muted)]",
  brand: "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]",
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  danger: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  info: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  outline: "border border-[var(--color-border-strong)] text-[var(--color-fg-muted)]",
};

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
