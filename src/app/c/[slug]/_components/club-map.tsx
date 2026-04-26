"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPinOff, Monitor } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Slot } from "./slot-picker";
import { Card } from "@/components/ui/card";

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
        const m: Availability = {};
        for (const row of data ?? []) m[row.station_id] = row.status;
        setAvailability(m);
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
      <Card className="flex flex-col items-center gap-2 border-dashed py-10 text-center text-sm text-[var(--color-fg-muted)]">
        <MapPinOff className="h-5 w-5" />
        В клубе ещё не размещены ПК
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Monitor className="h-4 w-4 text-[var(--color-brand-400)]" />
          Карта зала
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
          {loading ? "Обновляется…" : "Live"}
        </span>
      </div>

      <div className="relative overflow-auto border-y border-[var(--color-border)] bg-[var(--color-bg-elev-2)]">
        <div
          className="relative mx-auto p-6"
          style={{
            width: grid.gridW * 36 + 48,
            height: grid.gridH * 36 + 48,
          }}
        >
          <div
            className="relative h-full w-full"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
              backgroundPosition: "-1px -1px",
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
                  className={`flex items-center justify-center rounded-[8px] border-2 text-[10px] font-bold text-white transition-all ${
                    isSelected
                      ? "scale-110 border-white shadow-[var(--shadow-glow)] ring-1 ring-[var(--color-brand-700)]"
                      : "border-transparent"
                  } ${
                    isClickable
                      ? "cursor-pointer hover:scale-110 hover:shadow-md"
                      : "cursor-not-allowed opacity-80"
                  }`}
                >
                  {s.name.replace(/[A-Za-z-]+/, "")}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 px-4 py-3 text-[11px] text-[var(--color-fg-muted)]">
        <Legend color="var(--color-brand-500)" label="Выбрано" />
        <Legend color="#8B5CF6" label="Свободно" />
        <Legend color="var(--color-danger)" label="Занято" />
        <Legend color="oklch(60% 0 0)" label="Обслуживание" />
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
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
