"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellRing, Check, Loader2, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatTenge } from "@/lib/utils";

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
  const soundRef = useRef<HTMLAudioElement | null>(null);

  // Realtime-подписка
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
              toast.success(`Новая бронь: ${full.booking_code}`);
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
    toast.success(action === "check-in" ? "Гость отмечен" : "No-show зафиксирован");
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <audio ref={soundRef} preload="auto">
        <source src="/sounds/new-booking.mp3" type="audio/mpeg" />
      </audio>

      <header className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h1 className="text-lg font-semibold">Today-board · {clubName}</h1>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {bookings.length} броней сегодня
          </p>
        </div>
        <button
          type="button"
          onClick={() => enableAudioAndNotifications(soundRef.current)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <BellRing className="h-3.5 w-3.5" /> Звук + уведомления
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {bookings.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted-foreground)]">
            Сегодня пока нет броней
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {bookings.map((b) => {
              const isNew = b.id === highlightId;
              const accent = accentFor(b);
              return (
                <li
                  key={b.id}
                  className={`grid grid-cols-12 items-center gap-3 px-4 py-3 transition ${
                    isNew ? "bg-[var(--color-success)]/10 ring-2 ring-[var(--color-success)]" : ""
                  } ${accent.row}`}
                >
                  <div className="col-span-2 font-mono text-sm">
                    {timeStr(b.starts_at)}
                    <span className="text-[color:var(--muted-foreground)]"> · {timeStr(b.ends_at)}</span>
                  </div>
                  <div className="col-span-3">
                    <p className="font-medium">
                      {b.users?.full_name ?? b.users?.email?.split("@")[0] ?? "—"}
                    </p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">{b.users?.phone ?? b.users?.email}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="text-sm">
                      {b.booking_stations.map((bs) => bs.stations?.name).filter(Boolean).join(", ")}
                    </p>
                    {b.notes && <p className="text-xs text-[color:var(--muted-foreground)]">{b.notes}</p>}
                  </div>
                  <div className="col-span-1 font-mono text-xs">{b.booking_code}</div>
                  <div className="col-span-1 text-right text-sm">{formatTenge(b.total_amount)}</div>
                  <div className="col-span-2 flex justify-end gap-2">
                    {b.status === "confirmed" && (
                      <>
                        <ActionBtn
                          title="Check-in"
                          color="success"
                          onClick={() => act(b.id, "check-in")}
                          loading={pending === b.id}
                        >
                          <Check className="h-4 w-4" />
                        </ActionBtn>
                        <ActionBtn
                          title="No-show"
                          color="danger"
                          onClick={() => act(b.id, "no-show")}
                          loading={pending === b.id}
                        >
                          <UserX className="h-4 w-4" />
                        </ActionBtn>
                      </>
                    )}
                    {b.status === "checked_in" && (
                      <span className="rounded-md bg-[var(--color-success)]/15 px-2 py-1 text-xs font-medium text-[var(--color-success)]">
                        В игре
                      </span>
                    )}
                    {b.status === "completed" && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs">Завершена</span>
                    )}
                    {b.status === "cancelled" && (
                      <span className="rounded-md bg-muted px-2 py-1 text-xs">Отменена</span>
                    )}
                    {b.status === "no_show" && (
                      <span className="rounded-md bg-[var(--color-danger)]/15 px-2 py-1 text-xs text-[var(--color-danger)]">
                        No-show
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  title,
  loading,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  loading: boolean;
  color: "success" | "danger";
}) {
  const bg = color === "success" ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-white ${bg} disabled:opacity-60`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function accentFor(b: Booking) {
  const now = Date.now();
  const start = new Date(b.starts_at).getTime();
  const end = new Date(b.ends_at).getTime();
  if (b.status === "checked_in" || (now >= start && now <= end)) return { row: "bg-[var(--color-success)]/5" };
  if (start - now <= 30 * 60 * 1000 && start - now > 0) return { row: "bg-[var(--color-warning)]/5" };
  if (now > end) return { row: "opacity-60" };
  return { row: "" };
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
  el.play().catch(() => {}); // ignore autoplay block
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
    toast.success("Звук и уведомления включены");
  } catch {
    toast.error("Не удалось включить звук — проверь настройки браузера");
  }
}
