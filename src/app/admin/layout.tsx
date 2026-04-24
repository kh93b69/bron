import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, Calendar, LayoutGrid, Map, Monitor, Radio, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: memberships } = await supabase
    .from("club_members")
    .select("role, club_id, clubs(id, name, slug)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding/club");
  }

  const currentClub = memberships[0];
  const isOwner = currentClub.role === "owner";

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 sm:flex">
        <div className="mb-4 flex flex-col">
          <span className="text-xs text-[color:var(--muted-foreground)]">клуб</span>
          <span className="font-semibold">{currentClub.clubs?.name}</span>
        </div>
        <NavItem href="/admin" icon={<LayoutGrid className="h-4 w-4" />}>Главная</NavItem>
        <NavItem href="/admin/today-board" icon={<Radio className="h-4 w-4" />}>
          Today-board
        </NavItem>
        <NavItem href="/admin/bookings" icon={<Calendar className="h-4 w-4" />}>Брони</NavItem>
        <NavItem href="/admin/stations" icon={<Monitor className="h-4 w-4" />}>ПК и зоны</NavItem>
        <NavItem href="/admin/map-editor" icon={<Map className="h-4 w-4" />}>Карта зала</NavItem>
        {isOwner && (
          <NavItem href="/admin/analytics" icon={<BarChart3 className="h-4 w-4" />}>
            Аналитика
          </NavItem>
        )}
        {isOwner && (
          <NavItem href="/admin/settings" icon={<Settings className="h-4 w-4" />}>Настройки</NavItem>
        )}
        <div className="mt-auto text-xs text-[color:var(--muted-foreground)]">
          {user.email}
        </div>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted"
    >
      {icon}
      {children}
    </Link>
  );
}
