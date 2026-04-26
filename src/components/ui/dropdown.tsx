"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownContext {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const Ctx = React.createContext<DropdownContext | null>(null);

export function Dropdown({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function DropdownTrigger({ children, className, asChild }: { children: React.ReactNode; className?: string; asChild?: boolean }) {
  const ctx = React.useContext(Ctx)!;
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => ctx.setOpen(!ctx.open),
    });
  }
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn("outline-none", className)}
    >
      {children}
    </button>
  );
}

export function DropdownContent({
  align = "end",
  className,
  children,
}: {
  align?: "start" | "end";
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(Ctx)!;
  if (!ctx.open) return null;
  return (
    <div
      className={cn(
        "absolute z-30 mt-2 min-w-[12rem] animate-slide-up overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev)] p-1 shadow-[var(--shadow-soft)]",
        align === "end" ? "right-0" : "left-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  className,
  children,
  onClick,
  destructive,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  destructive?: boolean;
}) {
  const ctx = React.useContext(Ctx)!;
  return (
    <button
      type="button"
      onClick={() => {
        ctx.setOpen(false);
        onClick?.();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm transition",
        "hover:bg-[var(--color-bg-elev-2)]",
        destructive && "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-[var(--color-border)]" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 text-xs font-medium text-[var(--color-fg-subtle)]">
      {children}
    </div>
  );
}
