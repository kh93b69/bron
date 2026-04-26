import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] gradient-brand text-white",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        aria-hidden
      >
        <path
          d="M3 7.5C3 6.119 4.119 5 5.5 5h13C19.881 5 21 6.119 21 7.5v7c0 1.381-1.119 2.5-2.5 2.5H8l-3.5 3.5C4.119 20.5 3 19.881 3 18.5v-11Z"
          fill="currentColor"
          opacity="0.9"
        />
        <circle cx="9" cy="11" r="1.25" fill="var(--color-brand-700)" />
        <circle cx="15" cy="11" r="1.25" fill="var(--color-brand-700)" />
      </svg>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight">CyberBook</span>
    </div>
  );
}
