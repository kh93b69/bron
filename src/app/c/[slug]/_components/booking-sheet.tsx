"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatTenge, hoursBetween } from "@/lib/utils";

type Station = { id: string; name: string; zone_id: string };
type Zone = { id: string; name: string; color: string; price_per_hour: number };
type Slot = { from: string; to: string };

type Stage = "summary" | "email" | "code" | "creating" | "success";

export function BookingSheet({
  open,
  onOpenChange,
  clubId,
  clubSlug,
  stations,
  zoneById,
  slot,
  total,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubId: string;
  clubSlug: string;
  stations: Station[];
  zoneById: Map<string, Zone>;
  slot: Slot;
  total: number;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("summary");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookingCode, setBookingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStage("summary");
        setCode("");
        setBookingCode(null);
      }, 200);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        setEmail(data.user.email);
        setStage("summary");
      }
    });
  }, [open]);

  async function startBooking() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await createBooking();
    } else {
      setStage("email");
    }
  }

  async function sendOtp() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setStage("code");
  }

  async function verifyAndBook() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    if (error) {
      setLoading(false);
      toast.error("Неверный или просроченный код");
      return;
    }
    await createBooking();
  }

  async function createBooking() {
    setStage("creating");
    setLoading(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          club_id: clubId,
          station_ids: stations.map((s) => s.id),
          starts_at: slot.from,
          ends_at: slot.to,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const reason =
          json?.error?.details?.pg_details ||
          json?.error?.message ||
          "Не удалось создать бронь";
        throw new Error(reason);
      }
      setBookingCode(json.data.booking_code);
      setStage("success");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка";
      toast.error(msg);
      setStage("summary");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const hours = hoursBetween(new Date(slot.from), new Date(slot.to));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full rounded-t-2xl border border-border bg-background p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold">
            {stage === "success" ? "Бронь подтверждена" : "Оформление брони"}
          </h3>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {stage === "summary" && (
          <>
            <SummaryList stations={stations} zoneById={zoneById} slot={slot} hours={hours} total={total} />
            <button
              type="button"
              onClick={startBooking}
              disabled={loading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-3 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Забронировать за {formatTenge(total)}
            </button>
          </>
        )}

        {stage === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendOtp();
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Мы отправим 6-значный код на email, чтобы подтвердить бронь. Пароль не нужен.
            </p>
            <input
              type="email"
              required
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Получить код
            </button>
          </form>
        )}

        {stage === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyAndBook();
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Код отправлен на <span className="font-medium">{email}</span>. Введи его ниже.
            </p>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="rounded-md border border-border bg-background px-3 py-3 text-center text-xl tracking-[0.3em]"
            />
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-brand-500)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-600)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Подтвердить и забронировать
            </button>
          </form>
        )}

        {stage === "creating" && (
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-[color:var(--muted-foreground)]">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-brand-500)]" />
            Создаём бронь…
          </div>
        )}

        {stage === "success" && bookingCode && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <p className="font-semibold">Код брони</p>
            <p className="select-all rounded-md border border-border bg-muted px-4 py-2 font-mono text-xl">
              {bookingCode}
            </p>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Покажи этот код на ресепшене. Ссылка и QR — в письме.
            </p>
            <a
              href={`/my/bookings`}
              className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
            >
              Мои брони
            </a>
            <a
              href={`/c/${clubSlug}`}
              className="text-xs text-[color:var(--muted-foreground)] hover:underline"
            >
              Вернуться к клубу
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryList({
  stations,
  zoneById,
  slot,
  hours,
  total,
}: {
  stations: Station[];
  zoneById: Map<string, Zone>;
  slot: Slot;
  hours: number;
  total: number;
}) {
  const from = new Date(slot.from);
  const to = new Date(slot.to);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-lg border border-border p-3">
        <div className="text-xs text-[color:var(--muted-foreground)]">Время</div>
        <div className="font-medium">
          {from.toLocaleDateString("ru-RU")} · {from.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — {to.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          <span className="ml-2 text-[color:var(--muted-foreground)]">({hours.toFixed(1)} ч)</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-border p-3">
        <div className="text-xs text-[color:var(--muted-foreground)]">Места ({stations.length})</div>
        {stations.map((s) => {
          const z = zoneById.get(s.zone_id);
          return (
            <div key={s.id} className="flex items-center justify-between">
              <span>
                <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: z?.color }} />
                {s.name} <span className="text-[color:var(--muted-foreground)]">· {z?.name}</span>
              </span>
              <span className="text-[color:var(--muted-foreground)]">
                {formatTenge(Math.round((z?.price_per_hour ?? 0) * hours))}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <span className="text-[color:var(--muted-foreground)]">Итого</span>
        <span className="text-lg font-bold">{formatTenge(total)}</span>
      </div>
    </div>
  );
}
