import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";
import { CalendarClock, Coins, Users, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, role, clubs(id, name)")
    .eq("user_id", user.id)
    .limit(1);
  const club = memberships?.[0];
  if (!club) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: todays } = await supabase
    .from("bookings")
    .select("id, status, total_amount, starts_at, ends_at")
    .eq("club_id", club.club_id)
    .gte("starts_at", startOfDay.toISOString())
    .lt("starts_at", endOfDay.toISOString())
    .in("status", ["confirmed", "checked_in", "completed"]);

  const totalRevenue =
    todays?.reduce((s, b) => s + (b.status !== "cancelled" ? b.total_amount : 0), 0) ?? 0;
  const active = todays?.filter((b) => b.status === "checked_in").length ?? 0;

  const { count: uniqueUsers } = await supabase
    .from("bookings")
    .select("user_id", { count: "exact", head: true })
    .eq("club_id", club.club_id)
    .gte("starts_at", startOfDay.toISOString())
    .lt("starts_at", endOfDay.toISOString());

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Сегодня · {club.clubs?.name}</h1>
        <p className="text-sm text-[color:var(--muted-foreground)]">
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat icon={<CalendarClock />} label="Броней" value={String(todays?.length ?? 0)} />
        <Stat icon={<Zap />} label="Сейчас в игре" value={String(active)} />
        <Stat icon={<Coins />} label="Оборот" value={formatTenge(totalRevenue)} />
        <Stat icon={<Users />} label="Гостей" value={String(uniqueUsers ?? 0)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/today-board"
          className="flex flex-col gap-1 rounded-xl border border-border p-5 transition hover:bg-muted"
        >
          <span className="text-sm text-[color:var(--muted-foreground)]">для рецепции</span>
          <span className="text-lg font-semibold">Открыть Today-board →</span>
          <span className="text-xs text-[color:var(--muted-foreground)]">
            Полноэкранный список, live-обновление, звуковое уведомление
          </span>
        </Link>
        <Link
          href="/admin/bookings"
          className="flex flex-col gap-1 rounded-xl border border-border p-5 transition hover:bg-muted"
        >
          <span className="text-sm text-[color:var(--muted-foreground)]">история</span>
          <span className="text-lg font-semibold">Все брони →</span>
          <span className="text-xs text-[color:var(--muted-foreground)]">Фильтры, экспорт, поиск</span>
        </Link>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-brand-100)] text-[var(--color-brand-700)]">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[color:var(--muted-foreground)]">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
