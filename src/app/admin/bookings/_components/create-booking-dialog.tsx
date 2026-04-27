"use client";

import { useMemo, useState } from "react";
import { Calendar, Loader2, Monitor, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatTenge, hoursBetween } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Zone = { id: string; name: string; color: string; price_per_hour: number };
type Station = { id: string; name: string; zone_id: string; status: string };

const DURATIONS = [1, 2, 3, 4, 5, 8];

export function CreateBookingDialog({
  open,
  onOpenChange,
  clubId,
  zones,
  stations,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubId: string;
  zones: Zone[];
  stations: Station[];
  onCreated: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.getHours();
  });
  const [duration, setDuration] = useState(2);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [zoneFilter, setZoneFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const visibleStations = zoneFilter ? stations.filter((s) => s.zone_id === zoneFilter) : stations;

  const startsAt = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`);
  const endsAt = new Date(startsAt);
  endsAt.setHours(endsAt.getHours() + duration);

  const total = stations
    .filter((s) => selectedIds.has(s.id))
    .reduce((sum, s) => sum + (zoneById.get(s.zone_id)?.price_per_hour ?? 0) * duration, 0);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_create_booking", {
      p_club_id: clubId,
      p_station_ids: Array.from(selectedIds),
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_guest_name: name.trim() || null,
      p_guest_phone: phone.trim() || null,
      p_notes: notes.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Не удалось создать бронь");
      return;
    }
    toast.success("Бронь создана");
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Создать бронь"
        description={step === 1 ? "Кто гость и на какое время" : "Выбери ПК"}
        onClose={() => onOpenChange(false)}
        className="max-w-2xl"
        footer={
          step === 1 ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button onClick={() => setStep(2)} disabled={!name.trim() || !phone.trim()}>
                Дальше · выбрать ПК
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Назад
              </Button>
              <Button onClick={submit} loading={loading} disabled={selectedIds.size === 0}>
                Создать · {formatTenge(total)}
              </Button>
            </>
          )
        }
      >
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Имя гостя">
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иван"
                  autoFocus
                />
              </Field>
              <Field label="Телефон">
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+77011112233"
                />
              </Field>
            </div>

            <div>
              <Label className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Когда
              </Label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
                />
                <select
                  value={hour}
                  onChange={(e) => setHour(Number(e.target.value))}
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="h-10 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} ч
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-fg-subtle)]">
                {startsAt.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                {" — "}
                {endsAt.toLocaleString("ru-RU", { timeStyle: "short" })}
              </p>
            </div>

            <Field label="Заметки (опционально)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Команда X, тренировка"
              />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Monitor className="h-4 w-4 text-[var(--color-fg-muted)]" />
              <button
                type="button"
                onClick={() => setZoneFilter("")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  zoneFilter === ""
                    ? "bg-[var(--color-brand-500)] text-white"
                    : "border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elev-2)]"
                }`}
              >
                Все ({stations.length})
              </button>
              {zones.map((z) => {
                const count = stations.filter((s) => s.zone_id === z.id).length;
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => setZoneFilter(z.id)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs transition ${
                      zoneFilter === z.id
                        ? "bg-[var(--color-brand-500)] text-white"
                        : "border border-[var(--color-border-strong)] hover:bg-[var(--color-bg-elev-2)]"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: z.color }} />
                    {z.name} ({count})
                  </button>
                );
              })}
            </div>

            {visibleStations.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-fg-muted)]">
                Нет ПК в этой зоне
              </div>
            ) : (
              <div className="grid max-h-[40vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-5">
                {visibleStations.map((s) => {
                  const zone = zoneById.get(s.zone_id);
                  const selected = selectedIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className={`flex flex-col items-center gap-1 rounded-[var(--radius-md)] border-2 p-2 text-xs transition ${
                        selected
                          ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/15"
                          : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: zone?.color }}
                      />
                      <span className="font-mono">{s.name}</span>
                      <span className="text-[10px] text-[var(--color-fg-subtle)]">
                        {formatTenge((zone?.price_per_hour ?? 0) * duration)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-500)]/10 p-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--color-brand-400)]" />
                <span className="font-medium">{name}</span>
                <span className="text-xs text-[var(--color-fg-muted)]">{phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="brand">{selectedIds.size} ПК</Badge>
                <Badge variant="default">{duration} ч</Badge>
                <span className="font-bold">{formatTenge(total)}</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Зачем utils — пусть будет
export { hoursBetween };
