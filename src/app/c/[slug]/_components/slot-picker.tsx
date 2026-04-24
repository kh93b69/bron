"use client";

import { Calendar, Clock3 } from "lucide-react";

export type Slot = { from: string; to: string };

const DURATIONS = [
  { h: 1, label: "1 ч" },
  { h: 2, label: "2 ч" },
  { h: 3, label: "3 ч" },
  { h: 5, label: "5 ч" },
  { h: 8, label: "ночь (8 ч)" },
];

export function SlotPicker({
  value,
  onChange,
  timezone,
}: {
  value: Slot;
  onChange: (s: Slot) => void;
  timezone: string;
}) {
  const from = new Date(value.from);
  const duration = Math.round((new Date(value.to).getTime() - from.getTime()) / 3_600_000);

  function setDate(date: string) {
    const d = new Date(date);
    d.setHours(from.getHours(), 0, 0, 0);
    const to = new Date(d);
    to.setHours(to.getHours() + duration);
    onChange({ from: d.toISOString(), to: to.toISOString() });
  }

  function setHour(hour: number) {
    const d = new Date(from);
    d.setHours(hour, 0, 0, 0);
    const to = new Date(d);
    to.setHours(to.getHours() + duration);
    onChange({ from: d.toISOString(), to: to.toISOString() });
  }

  function setDuration(h: number) {
    const to = new Date(from);
    to.setHours(to.getHours() + h);
    onChange({ from: value.from, to: to.toISOString() });
  }

  const dateStr = from.toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Calendar className="h-4 w-4" /> Когда будешь играть
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">TZ {timezone}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[color:var(--muted-foreground)]">Дата</span>
          <input
            type="date"
            value={dateStr}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[color:var(--muted-foreground)]">Час начала</span>
          <select
            value={from.getHours()}
            onChange={(e) => setHour(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs">
          <span className="text-[color:var(--muted-foreground)]">
            <Clock3 className="inline h-3 w-3" /> Длительность
          </span>
          <div className="flex flex-wrap gap-1">
            {DURATIONS.map((d) => (
              <button
                key={d.h}
                type="button"
                onClick={() => setDuration(d.h)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
                  duration === d.h
                    ? "border-[var(--color-brand-500)] bg-[var(--color-brand-500)] text-white"
                    : "border-border hover:bg-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
