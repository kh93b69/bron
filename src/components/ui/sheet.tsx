"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetContent({
  className,
  children,
  onClose,
  title,
}: {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
  title?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative animate-sheet-up rounded-t-[var(--radius-2xl)] sm:rounded-[var(--radius-2xl)]",
        "border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] shadow-[var(--shadow-soft)]",
        "max-h-[92vh] overflow-y-auto",
        className,
      )}
    >
      {(title || onClose) && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-elev)]/90 px-5 py-3.5 backdrop-blur-md">
          <h3 className="text-base font-semibold">{title}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="rounded-md p-1.5 text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elev-2)] hover:text-[var(--color-fg)]"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
