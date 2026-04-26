import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Coins,
  Radio,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .limit(1);
  const clubId = memberships?.[0]?.club_id;
  if (!clubId) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: todays } = await supabase
    .from("bookings")
    .select("id, status, total_amount, starts_at, ends_at, user_id")
    .eq("club_id", clubId)
    .gte("starts_at", startOfDay.toISOString())
    .lt("starts_at", endOfDay.toISOString());

  const all = todays ?? [];
  const totalRevenue = all
    .filter((b) => b.status !== "cancelled")
    .reduce((s, b) => s + b.total_amount, 0);
  const active = all.filter((b) => b.status === "checked_in").length;
  const upcoming = all.filter((b) => b.status === "confirmed" && new Date(b.starts_at) > new Date());
  const guests = new Set(all.map((b) => b.user_id)).size;

  // Загрузка сейчас
  const { count: stationsTotal } = await supabase
    .from("stations")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "active");

  const now = new Date().toISOString();
  const { count: stationsBookedNow } = await supabase
    .from("booking_stations")
    .select("station_id, bookings!inner(starts_at, ends_at, club_id, status)", {
      count: "exact",
      head: true,
    })
    .eq("bookings.club_id", clubId)
    .lte("bookings.starts_at", now)
    .gte("bookings.ends_at", now)
    .in("bookings.status", ["confirmed", "checked_in"]);

  const occupancyPct = stationsTotal
    ? Math.round((100 * (stationsBookedNow ?? 0)) / stationsTotal)
    : 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Сегодня</h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Броней сегодня"
          value={String(all.length)}
          hint={upcoming.length > 0 ? `${upcoming.length} впереди` : undefined}
          tone="brand"
        />
        <StatCard
          icon={<Zap className="h-5 w-5" />}
          label="Сейчас в игре"
          value={String(active)}
          tone="success"
        />
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Оборот сегодня"
          value={formatTenge(totalRevenue)}
          tone="warning"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Уникальных гостей"
          value={String(guests)}
          tone="info"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--color-brand-400)]" />
                Загрузка зала
              </CardTitle>
              <CardDescription>
                {stationsBookedNow ?? 0} из {stationsTotal ?? 0} ПК заняты прямо сейчас
              </CardDescription>
            </div>
            <span className="text-3xl font-bold tracking-tight gradient-text">{occupancyPct}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-bg-elev-2)]">
            <div
              className="h-full rounded-full gradient-brand transition-all duration-500"
              style={{ width: `${occupancyPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Link href="/admin/today-board" className="group">
          <Card className="h-full transition hover:border-[var(--color-brand-500)]/40">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]">
                <Radio className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Today-board</span>
                  <ArrowRight className="h-4 w-4 text-[var(--color-fg-subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-fg)]" />
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  Полноэкранный режим для рецепции. Live-обновление + звук на новой брони.
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bookings" className="group">
          <Card className="h-full transition hover:border-[var(--color-brand-500)]/40">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-info)]/15 text-[var(--color-info)]">
                <Clock className="h-5 w-5" />
              </div>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">История броней</span>
                  <ArrowRight className="h-4 w-4 text-[var(--color-fg-subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-fg)]" />
                </div>
                <span className="text-xs text-[var(--color-fg-muted)]">
                  Фильтры по дате/статусу, поиск по коду или email клиента
                </span>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Onboarding hints */}
      {(!stationsTotal || stationsTotal === 0) && (
        <Card className="border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="warning">Незавершённая настройка</Badge>
              </div>
              <p className="mt-2 text-sm">
                В клубе пока нет ПК — добавь зоны и места, чтобы геймеры могли бронировать.
              </p>
            </div>
            <Link href="/admin/zones">
              <Button>Добавить зоны</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone: "brand" | "success" | "warning" | "info";
}) {
  const toneStyles: Record<typeof tone, string> = {
    brand: "bg-[var(--color-brand-500)]/15 text-[var(--color-brand-300)]",
    success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
    info: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  };
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${toneStyles[tone]}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-[var(--color-fg-muted)]">{label}</span>
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {hint && <span className="text-[11px] text-[var(--color-fg-subtle)]">{hint}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
