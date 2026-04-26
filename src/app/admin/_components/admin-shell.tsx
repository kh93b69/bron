"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Monitor,
  Radio,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/ui/logo";
import { Badge } from "@/components/ui/badge";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils";

type ClubInfo = { id: string; name: string; slug: string; plan: string };
type Me = { email: string; role: "owner" | "admin" };

const NAV: Array<{
  href: string;
  label: string;
  icon: React.ReactNode;
  ownerOnly?: boolean;
}> = [
  { href: "/admin", label: "Главная", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/admin/today-board", label: "Today-board", icon: <Radio className="h-4 w-4" /> },
  { href: "/admin/bookings", label: "Брони", icon: <Calendar className="h-4 w-4" /> },
  { href: "/admin/zones", label: "Зоны и тарифы", icon: <Sparkles className="h-4 w-4" /> },
  { href: "/admin/stations", label: "ПК", icon: <Monitor className="h-4 w-4" /> },
  { href: "/admin/map-editor", label: "Карта зала", icon: <Map className="h-4 w-4" /> },
  { href: "/admin/analytics", label: "Аналитика", icon: <BarChart3 className="h-4 w-4" />, ownerOnly: true },
  { href: "/admin/settings", label: "Настройки", icon: <Settings className="h-4 w-4" />, ownerOnly: true },
];

export function AdminShell({
  club,
  me,
  children,
}: {
  club: ClubInfo;
  me: Me;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => setMobileOpen(false), [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    toast.success("До скорого!");
    window.location.assign("/login");
  }

  const items = NAV.filter((n) => !n.ownerOnly || me.role === "owner");

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      {/* desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)] lg:flex">
        <div className="flex h-16 items-center border-b border-[var(--color-border)] px-5">
          <Logo />
        </div>
        <ClubBlock club={club} />
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <UserBlock me={me} onLogout={logout} />
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 animate-fade bg-black/60 backdrop-blur-sm" />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-72 animate-slide-up flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elev)]"
          >
            <div className="flex h-16 items-center justify-between border-b border-[var(--color-border)] px-5">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Закрыть"
                className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elev-2)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ClubBlock club={club} />
            <nav className="flex flex-1 flex-col gap-0.5 p-3">
              {items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
              ))}
            </nav>
            <UserBlock me={me} onLogout={logout} />
          </aside>
        </div>
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 px-4 backdrop-blur-md sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Меню"
            className="rounded-md p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elev-2)]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
          <div className="ml-auto">
            <Dropdown>
              <DropdownTrigger>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-500)]/15 text-sm font-semibold text-[var(--color-brand-300)]">
                  {me.email[0]?.toUpperCase()}
                </div>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>{me.email}</DropdownLabel>
                <DropdownSeparator />
                <DropdownItem onClick={() => router.push("/admin/settings")}>
                  <Settings className="h-4 w-4" /> Настройки
                </DropdownItem>
                <DropdownItem destructive onClick={logout}>
                  <LogOut className="h-4 w-4" /> Выйти
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function ClubBlock({ club }: { club: ClubInfo }) {
  return (
    <div className="border-b border-[var(--color-border)] px-5 py-4">
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        Клуб
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{club.name}</span>
        <Badge variant={planVariant(club.plan)}>{club.plan}</Badge>
      </div>
      <Link
        href={`/c/${club.slug}`}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-brand-300)]"
      >
        <Globe className="h-3 w-3" />
        /c/{club.slug}
      </Link>
    </div>
  );
}

function planVariant(plan: string) {
  if (plan === "pro" || plan === "network") return "brand" as const;
  if (plan === "start") return "info" as const;
  return "outline" as const;
}

function NavLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ReactNode };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
        active
          ? "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-200)]"
          : "text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elev-2)] hover:text-[var(--color-fg)]",
      )}
    >
      {item.icon}
      {item.label}
    </Link>
  );
}

function UserBlock({ me, onLogout }: { me: Me; onLogout: () => void }) {
  return (
    <div className="border-t border-[var(--color-border)] p-3">
      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-[var(--radius-md)] p-2 text-left transition hover:bg-[var(--color-bg-elev-2)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-500)]/15 text-sm font-semibold text-[var(--color-brand-300)]">
              {me.email[0]?.toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{me.email}</span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
                {me.role === "owner" ? "Владелец" : "Администратор"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-[var(--color-fg-subtle)]" />
          </button>
        </DropdownTrigger>
        <DropdownContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[14rem]">
          <DropdownLabel>{me.email}</DropdownLabel>
          <DropdownSeparator />
          <DropdownItem destructive onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Выйти
          </DropdownItem>
        </DropdownContent>
      </Dropdown>
    </div>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}
