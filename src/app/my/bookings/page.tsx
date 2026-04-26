import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "brand" | "success" | "warning" | "danger" | "info" | "default" }> = {
  pending: { label: "ожидает", variant: "warning" },
  confirmed: { label: "подтверждена", variant: "info" },
  checked_in: { label: "в игре", variant: "success" },
  completed: { label: "завершена", variant: "default" },
  cancelled: { label: "отменена", variant: "default" },
  no_show: { label: "не пришёл", variant: "danger" },
};

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/my/bookings");

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, starts_at, ends_at, status, total_amount, club_id, clubs(name, slug, city), booking_stations(stations(name))",
    )
    .eq("user_id", user.id)
    .order("starts_at", { ascending: false })
    .limit(50);

  const list = (data ?? []).map((b) => ({
    ...b,
    club: Array.isArray(b.clubs) ? b.clubs[0] : b.clubs,
  }));
  const now = Date.now();
  const upcoming = list.filter((b) => new Date(b.ends_at).getTime() > now);
  const past = list.filter((b) => new Date(b.ends_at).getTime() <= now);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
      >
        <ArrowLeft className="h-4 w-4" />
        На главную
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Мои брони</h1>
      <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
        {list.length === 0 ? "Пока пусто" : `${list.length} броней за всё время`}
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Предстоящие
        </h2>
        {upcoming.length === 0 ? (
          <EmptyUpcoming />
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} isPast={false} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
            История
          </h2>
          <ul className="flex flex-col gap-3">
            {past.map((b) => (
              <BookingRow key={b.id} b={b} isPast />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

type Row = {
  id: string;
  booking_code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_amount: number;
  club: { name: string; slug: string; city: string } | null;
  booking_stations: Array<{ stations: { name: string } | null }>;
};

function BookingRow({ b, isPast }: { b: Row; isPast: boolean }) {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  const status = STATUS[b.status] ?? { label: b.status, variant: "default" as const };
  return (
    <Card className={isPast ? "opacity-60" : ""}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{b.club?.name ?? "Клуб"}</span>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {start.toLocaleDateString("ru-RU")} ·{" "}
              {start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} —{" "}
              {end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {b.booking_stations
                .map((bs) => bs.stations?.name)
                .filter(Boolean)
                .join(", ")}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end">
          <span className="rounded-md bg-[var(--color-bg-elev-2)] px-2.5 py-1 font-mono text-xs">
            {b.booking_code}
          </span>
          <span className="text-sm font-semibold">{formatTenge(b.total_amount)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyUpcoming() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-[var(--color-fg-muted)]">
        <CalendarClock className="h-6 w-6 text-[var(--color-fg-subtle)]" />
        У тебя нет предстоящих броней
        <Link href="/">
          <Button size="sm" variant="outline">
            Найти клуб
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
