import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Clock, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyBookingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/my/bookings");

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, starts_at, ends_at, status, total_amount, club_id, clubs(name, slug, city)",
    )
    .eq("user_id", user.id)
    .order("starts_at", { ascending: false })
    .limit(30);

  const now = Date.now();
  const upcoming = (bookings ?? []).filter((b) => new Date(b.ends_at).getTime() > now);
  const past = (bookings ?? []).filter((b) => new Date(b.ends_at).getTime() <= now);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">Мои брони</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[color:var(--muted-foreground)]">Предстоящие</h2>
        {upcoming.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-3">
            {upcoming.map((b) => (
              <BookingRow key={b.id} b={b} isPast={false} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-[color:var(--muted-foreground)]">Архив</h2>
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

type BookingRowType = {
  id: string;
  booking_code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_amount: number;
  clubs: { name: string; slug: string; city: string } | null;
};

function BookingRow({ b, isPast }: { b: BookingRowType; isPast: boolean }) {
  const start = new Date(b.starts_at);
  const end = new Date(b.ends_at);
  return (
    <li className={`rounded-xl border border-border p-4 ${isPast ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{b.clubs?.name ?? "Клуб"}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-[color:var(--muted-foreground)]">
            <Clock className="h-3 w-3" />
            {start.toLocaleDateString("ru-RU")} · {start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — {end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            <StatusBadge status={b.status} />
            <span className="text-[color:var(--muted-foreground)]">· {formatTenge(b.total_amount)}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{b.booking_code}</span>
          {b.clubs && (
            <Link
              href={`/c/${b.clubs.slug}`}
              className="text-xs text-[color:var(--muted-foreground)] hover:underline"
            >
              клуб →
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: "ожидает", color: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
    confirmed: { label: "подтверждена", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
    checked_in: { label: "в игре", color: "bg-green-500/15 text-green-700 dark:text-green-300" },
    completed: { label: "завершена", color: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300" },
    cancelled: { label: "отменена", color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
    no_show: { label: "не пришёл", color: "bg-red-500/15 text-red-700 dark:text-red-300" },
  };
  const { label, color } = map[status] ?? { label: status, color: "bg-muted" };
  return <span className={`rounded-md px-2 py-0.5 text-xs ${color}`}>{label}</span>;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-[color:var(--muted-foreground)]">
      <CalendarClock className="h-5 w-5" />
      У тебя ещё нет броней.
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
      >
        <QrCode className="h-3.5 w-3.5" /> Найти клуб
      </Link>
    </div>
  );
}
