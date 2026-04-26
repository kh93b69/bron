"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatTenge, hoursBetween } from "@/lib/utils";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

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
      }, 250);
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
    if (user) await createBooking();
    else setStage("email");
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
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setStage("summary");
    } finally {
      setLoading(false);
    }
  }

  const hours = hoursBetween(new Date(slot.from), new Date(slot.to));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={stage === "success" ? "Бронь подтверждена" : "Оформление брони"}
        onClose={() => onOpenChange(false)}
      >
        {stage === "summary" && (
          <>
            <Summary stations={stations} zoneById={zoneById} slot={slot} hours={hours} total={total} />
            <Button
              size="lg"
              className="mt-5 w-full"
              loading={loading}
              onClick={startBooking}
            >
              Забронировать за {formatTenge(total)}
            </Button>
            <p className="mt-3 text-center text-[11px] text-[var(--color-fg-subtle)]">
              Подтверждение по 6-значному коду на email · без регистрации
            </p>
          </>
        )}

        {stage === "email" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendOtp();
            }}
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-[var(--color-fg-muted)]">
              Введи email — пришлём 6-значный код для подтверждения брони.
            </p>
            <Field label="Email">
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value.trim())}
                placeholder="you@example.com"
              />
            </Field>
            <Button type="submit" loading={loading} disabled={!email}>
              <Mail className="h-4 w-4" />
              Получить код
            </Button>
          </form>
        )}

        {stage === "code" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyAndBook();
            }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-3 text-xs text-[var(--color-fg-muted)]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-brand-400)]" />
              <span>
                Код отправлен на <b className="text-[var(--color-fg)]">{email}</b>. Проверь «Промоакции» / «Спам».
              </span>
            </div>
            <Field label="Код из письма">
              <Input
                type="text"
                inputMode="numeric"
                pattern="\d{6,10}"
                maxLength={10}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-center font-mono text-2xl tracking-[0.4em]"
              />
            </Field>
            <Button type="submit" loading={loading} disabled={code.length < 6}>
              Подтвердить и забронировать
            </Button>
            <button
              type="button"
              onClick={() => setStage("email")}
              className="inline-flex items-center justify-center gap-1.5 text-xs text-[var(--color-fg-muted)] transition hover:text-[var(--color-fg)]"
            >
              <ArrowLeft className="h-3 w-3" />
              Поменять email
            </button>
          </form>
        )}

        {stage === "creating" && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-[var(--color-fg-muted)]">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--color-brand-500)]" />
            Создаём бронь…
          </div>
        )}

        {stage === "success" && bookingCode && (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success)]/15 text-[var(--color-success)]">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)]">
                Код брони
              </div>
              <div className="mt-1 select-all rounded-[var(--radius-md)] border border-[var(--color-brand-500)]/30 bg-[var(--color-brand-500)]/10 px-5 py-3 font-mono text-2xl font-bold tracking-wider text-[var(--color-brand-200)]">
                {bookingCode}
              </div>
            </div>
            <p className="text-xs text-[var(--color-fg-muted)]">
              Покажи этот код на ресепшене. Письмо с QR-кодом и ссылкой — у тебя на почте.
            </p>
            <div className="mt-2 flex gap-2">
              <Link href="/my/bookings">
                <Button variant="outline">Мои брони</Button>
              </Link>
              <Link href={`/c/${clubSlug}`}>
                <Button variant="ghost">Ещё ПК</Button>
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Summary({
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
      <Row label="Время">
        <div className="font-medium">
          {from.toLocaleDateString("ru-RU")} ·{" "}
          {from.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} —{" "}
          {to.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <div className="text-xs text-[var(--color-fg-subtle)]">{hours.toFixed(1)} часа</div>
      </Row>
      <Row label={`Места (${stations.length})`}>
        <ul className="flex flex-col gap-1.5">
          {stations.map((s) => {
            const z = zoneById.get(s.zone_id);
            return (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: z?.color }}
                  />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-[var(--color-fg-subtle)]">{z?.name}</span>
                </span>
                <span className="text-[var(--color-fg-muted)]">
                  {formatTenge(Math.round((z?.price_per_hour ?? 0) * hours))}
                </span>
              </li>
            );
          })}
        </ul>
      </Row>
      <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-[var(--color-brand-500)]/10 px-4 py-3">
        <span className="text-sm text-[var(--color-fg-muted)]">Итого</span>
        <span className="text-xl font-bold tracking-tight">{formatTenge(total)}</span>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elev-2)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
