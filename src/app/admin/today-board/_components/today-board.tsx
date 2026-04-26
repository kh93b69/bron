"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, Clock, Loader2, Maximize2, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTenge } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Booking = {
  id: string;
  booking_code: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: "pending" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show";
  total_amount: number;
  notes: string | null;
  users: { full_name: string | null; email: string; phone: string | null } | null;
  booking_stations: Array<{ station_id: string; stations: { name: string } | null }>;
};

export function TodayBoard({
  clubId,
  clubName,
  initial,
}: {
  clubId: string;
  clubName: string;
  initial: Booking[];
}) {
  const [bookings, setBookings] = useState<Booking[]>(initial);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const soundRef = useRef<HTMLAudioElement | null>(null);

  // Тикер каждые 30с — обновляем подсветку «сейчас идёт» / «через 30 мин»
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`club:${clubId}:bookings`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `club_id=eq.${clubId}` },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const full = await fetchBooking(supabase, (payload.new as Booking).id);
            if (full) {
              setBookings((prev) => upsert(prev, full));
              setHighlightId(full.id);
              playSound(soundRef.current);
              toast.success(`Новая бронь · ${full.booking_code}`);
              setTimeout(() => setHighlightId(null), 5000);
            }
          } else if (payload.eventType === "UPDATE") {
            const full = await fetchBooking(supabase, (payload.new as Booking).id);
            if (full) setBookings((prev) => upsert(prev, full));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

  const act = useCallback(async (id: string, action: "check-in" | "no-show") => {
    setPending(id);
    const res = await fetch(`/api/admin/bookings/${id}/${action}`, { method: "POST" });
    setPending(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json?.error?.message ?? "Не удалось выполнить");
      return;
    }
    toast.success(action === "check-in" ? "Гость пришёл" : "No-show зафиксирован");
  }, []);

  const counts = {
    upcoming: bookings.filter((b) => b.status === "confirmed").length,
    active: bookings.filter((b) => b.status === "checked_in").length,
    done: bookings.filter((b) => ["completed", "cancelled", "no_show"].includes(b.status)).length,
  };

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)]">
      <audio ref={soundRef} preload="auto">
        <source src="/sounds/new-booking.mp3" type="audio/mpeg" />
      </audio>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-elev)] px-5 py-3">
        <div className="flex flex-col">
          <span className="text-xs text-[var(--color-fg-subtle)]">Today-board</span>
          <h1 className="text-lg font-semibold tracking-tight">{clubName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="brand">{counts.upcoming} впереди</Badge>
          <Badge variant="success">{counts.active} в игре</Badge>
          <Badge variant="outline">{counts.done} завершено</Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => enableAudioAndNotifications(soundRef.current)}
          >
            <BellRing className="h-3.5 w-3.5" />
            Звук + уведомления
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Полный экран"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {bookings.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {bookings.map((b) => (
              <Row
                key={b.id}
                b={b}
                isNew={b.id === highlightId}
                pending={pending === b.id}
                now={now}
                onCheckIn={() => act(b.id, "check-in")}
                onNoShow={() => act(b.id, "no-show")}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({
  b,
  isNew,
  pending,
  now,
  onCheckIn,
  onNoShow,
}: {
  b: Booking;
  isNew: boolean;
  pending: boolean;
  now: number;
  onCheckIn: () => void;
  onNoShow: () => void;
}) {
  const start = new Date(b.starts_at).getTime();
  const end = new Date(b.ends_at).getTime();
  const isLive = b.status === "checked_in" || (now >= start && now <= end);
  const isSoon = b.status === "confirmed" && start - now <= 30 * 60 * 1000 && start - now > 0;
  const isPast = now > end;

  return (
    <li
      className={`grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors ${
        isNew
          ? "animate-pulse-ring bg-[var(--color-success)]/10"
          : isLive
            ? "bg-[var(--color-success)]/5"
            : isSoon
              ? "bg-[var(--color-warning)]/5"
              : isPast
                ? "opacity-60"
                : ""
      }`}
    >
      <div className="col-span-3 sm:col-span-2">
        <div className="font-mono text-sm font-medium tabular-nums">
          {timeStr(b.starts_at)} — {timeStr(b.ends_at)}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--color-fg-subtle)]">
          <Clock className="mr-0.5 inline h-3 w-3 align-[-2px]" />
          {hoursStr(start, end)}
        </div>
      </div>
      <div className="col-span-9 sm:col-span-3">
        <div className="truncate font-medium">
          {b.users?.full_name ?? b.users?.email?.split("@")[0] ?? "—"}
        </div>
        <div className="truncate text-xs text-[var(--color-fg-subtle)]">
          {b.users?.phone ?? b.users?.email}
        </div>
      </div>
      <div className="col-span-12 sm:col-span-3">
        <div className="text-sm">
          {b.booking_stations.map((bs) => bs.stations?.name).filter(Boolean).join(", ") || "—"}
        </div>
        {b.notes && (
          <div className="truncate text-xs text-[var(--color-fg-subtle)]">{b.notes}</div>
        )}
      </div>
      <div className="col-span-6 sm:col-span-2 flex items-center gap-2 font-mono text-xs">
        <span className="rounded-md bg-[var(--color-bg-elev-2)] px-2 py-0.5">{b.booking_code}</span>
        <span className="text-[var(--color-fg-muted)]">{formatTenge(b.total_amount)}</span>
      </div>
      <div className="col-span-6 sm:col-span-2 flex justify-end gap-2">
        <StatusActions b={b} pending={pending} onCheckIn={onCheckIn} onNoShow={onNoShow} />
      </div>
    </li>
  );
}

function StatusActions({
  b,
  pending,
  onCheckIn,
  onNoShow,
}: {
  b: Booking;
  pending: boolean;
  onCheckIn: () => void;
  onNoShow: () => void;
}) {
  if (b.status === "confirmed") {
    return (
      <>
        <Button size="icon" variant="success" loading={pending} onClick={onCheckIn} aria-label="Check-in">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="danger" loading={pending} onClick={onNoShow} aria-label="No-show">
          <UserX className="h-4 w-4" />
        </Button>
      </>
    );
  }
  if (b.status === "checked_in") return <Badge variant="success">В игре</Badge>;
  if (b.status === "completed") return <Badge variant="default">Завершена</Badge>;
  if (b.status === "cancelled") return <Badge variant="default">Отменена</Badge>;
  if (b.status === "no_show") return <Badge variant="danger">No-show</Badge>;
  return <Badge variant="outline">{b.status}</Badge>;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-sm text-[var(--color-fg-muted)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-bg-elev)]">
        <Clock className="h-5 w-5 text-[var(--color-fg-subtle)]" />
      </div>
      Сегодня ещё нет броней
      <span className="text-xs text-[var(--color-fg-subtle)]">
        Когда геймеры начнут бронировать — они появятся здесь в реальном времени
      </span>
    </div>
  );
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
function hoursStr(startMs: number, endMs: number) {
  const h = Math.round(((endMs - startMs) / 3600_000) * 10) / 10;
  return `${h} ч`;
}
function upsert(list: Booking[], b: Booking) {
  const i = list.findIndex((x) => x.id === b.id);
  if (i === -1) return [...list, b].sort((a, z) => a.starts_at.localeCompare(z.starts_at));
  const copy = list.slice();
  copy[i] = b;
  return copy;
}
async function fetchBooking(
  supabase: ReturnType<typeof createClient>,
  id: string,
): Promise<Booking | null> {
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, user_id, starts_at, ends_at, status, total_amount, notes, users(full_name, email, phone), booking_stations(station_id, stations(name))",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Booking) ?? null;
}
function playSound(el: HTMLAudioElement | null) {
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}
async function enableAudioAndNotifications(el: HTMLAudioElement | null) {
  try {
    if (el) {
      await el.play();
      el.pause();
      el.currentTime = 0;
    }
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    toast.success("Звук включён");
  } catch {
    toast.error("Браузер блокирует звук — проверь настройки");
  }
}
