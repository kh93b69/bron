"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinOff, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Slot } from "./slot-picker";

type Station = {
  id: string;
  name: string;
  zone_id: string;
  position_x: number;
  position_y: number;
  specs: Record<string, unknown> | null;
  status: "active" | "maintenance" | "retired";
};

type Zone = { id: string; name: string; color: string; price_per_hour: number };
type Availability = Record<string, "available" | "booked" | "maintenance">;

export function ClubMap({
  clubId,
  stations,
  zones,
  map,
  slot,
  selected,
  onToggle,
  disabled,
}: {
  clubId: string;
  stations: Station[];
  zones: Zone[];
  map: unknown;
  slot: Slot;
  selected: Station[];
  onToggle: (s: Station) => void;
  disabled: boolean;
}) {
  const grid = parseLayout(map);
  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase.rpc("availability_for_slot", {
        p_club_id: clubId,
        p_from: slot.from,
        p_to: slot.to,
      });
      if (cancelled) return;
      if (error) {
        console.error(error);
        setAvailability({});
      } else {
        const map: Availability = {};
        for (const row of data ?? []) {
          map[row.station_id] = row.status;
        }
        setAvailability(map);
      }
      setLoading(false);
    }

    load();
    const t = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [clubId, slot.from, slot.to]);

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-[color:var(--muted-foreground)]">
        <MapPinOff className="h-5 w-5" />
        В клубе ещё не размещены ПК на карте
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="h-4 w-4" /> Карта зала
        </h2>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {loading ? "Обновляется…" : "Актуально"}
        </span>
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-muted p-4">
        <div
          className="relative mx-auto"
          style={{
            width: grid.gridW * 36,
            height: grid.gridH * 36,
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        >
          {stations.map((s) => {
            const zone = zoneById.get(s.zone_id);
            const availStatus =
              s.status === "maintenance"
                ? "maintenance"
                : (availability?.[s.id] ?? "available");
            const isSelected = selectedIds.has(s.id);
            const isClickable = !disabled && availStatus === "available";

            const bg =
              availStatus === "booked"
                ? "var(--color-danger)"
                : availStatus === "maintenance"
                  ? "oklch(60% 0 0)"
                  : isSelected
                    ? "var(--color-brand-500)"
                    : (zone?.color ?? "#8B5CF6");

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => isClickable && onToggle(s)}
                disabled={!isClickable}
                aria-label={`${s.name} — ${statusLabel(availStatus)}`}
                title={`${s.name}${zone ? ` · ${zone.name}` : ""}`}
                style={{
                  position: "absolute",
                  left: s.position_x * 36 + 2,
                  top: s.position_y * 36 + 2,
                  width: 32,
                  height: 32,
                  backgroundColor: bg,
                }}
                className={`rounded-md border-2 text-[10px] font-semibold text-white transition ${
                  isSelected ? "border-white ring-2 ring-[var(--color-brand-700)]" : "border-transparent"
                } ${isClickable ? "cursor-pointer hover:scale-110" : "cursor-not-allowed opacity-80"}`}
              >
                {s.name.slice(-2)}
              </button>
            );
          })}
        </div>
      </div>

      <Legend />
    </section>
  );
}

function Legend() {
  const items: Array<{ color: string; label: string }> = [
    { color: "var(--color-brand-500)", label: "Выбрано" },
    { color: "#8B5CF6", label: "Свободно" },
    { color: "var(--color-danger)", label: "Занято" },
    { color: "oklch(60% 0 0)", label: "Обслуживание" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function statusLabel(s: string) {
  if (s === "booked") return "занято";
  if (s === "maintenance") return "на обслуживании";
  return "свободно";
}

function parseLayout(raw: unknown): { gridW: number; gridH: number } {
  if (raw && typeof raw === "object" && "gridW" in raw && "gridH" in raw) {
    const r = raw as { gridW: unknown; gridH: unknown };
    return {
      gridW: Math.min(Math.max(Number(r.gridW) || 20, 4), 40),
      gridH: Math.min(Math.max(Number(r.gridH) || 15, 4), 40),
    };
  }
  return { gridW: 20, gridH: 15 };
}
