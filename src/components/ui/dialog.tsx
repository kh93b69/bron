"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogContent({
  className,
  title,
  description,
  children,
  onClose,
  footer,
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  onClose?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "animate-slide-up overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] shadow-2xl",
        "max-h-[88vh] flex flex-col",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-[var(--color-fg-muted)]">{description}</p>
          )}
        </div>
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
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Удалить",
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        onClose={() => onOpenChange(false)}
      >
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-[var(--radius-md)] px-4 py-2 text-sm text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elev-2)] hover:text-[var(--color-fg)]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } finally {
                setLoading(false);
              }
            }}
            className={cn(
              "rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50",
              destructive
                ? "bg-[var(--color-danger)] hover:opacity-90"
                : "bg-[var(--color-brand-500)] hover:bg-[var(--color-brand-600)]",
            )}
          >
            {loading ? "Минутку…" : confirmLabel}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
