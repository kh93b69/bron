"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clock, Instagram, MapPin } from "lucide-react";
import { formatTenge, hoursBetween } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";
import { ClubMap } from "./club-map";
import { BookingSheet } from "./booking-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Club = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  open_time: string;
  close_time: string;
  logo_url: string | null;
  cover_url: string | null;
  description: string | null;
  instagram?: string | null;
};

type Zone = {
  id: string;
  name: string;
  color: string;
  price_per_hour: number;
  sort_order: number;
};

type Station = {
  id: string;
  name: string;
  zone_id: string;
  position_x: number;
  position_y: number;
  specs: Record<string, unknown> | null;
  status: "active" | "maintenance" | "retired";
};

export function ClubShowcase({
  club,
  zones,
  stations,
  map,
  paused,
}: {
  club: Club;
  zones: Zone[];
  stations: Station[];
  map: unknown;
  paused: boolean;
}) {
  const [slot, setSlot] = useState(() => defaultSlot());
  const [selected, setSelected] = useState<Station[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const hours = hoursBetween(new Date(slot.from), new Date(slot.to));
  const total = selected.reduce(
    (sum, s) => sum + (zoneById.get(s.zone_id)?.price_per_hour ?? 0) * hours,
    0,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-24 sm:px-6">
      {club.cover_url && (
        <div className="relative -mx-4 h-48 overflow-hidden sm:-mx-6 sm:h-64 sm:rounded-b-[var(--radius-2xl)]">
          <Image src={club.cover_url} alt={club.name} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-bg)]" />
        </div>
      )}

      <header className="flex items-start gap-4 pt-2">
        {club.logo_url ? (
          <Image
            src={club.logo_url}
            alt={club.name}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-[var(--radius-lg)] border border-[var(--color-border)] object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--radius-lg)] gradient-brand text-2xl font-bold text-white">
            {club.name[0]}
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{club.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {club.city}, {club.address}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {club.open_time.slice(0, 5)} – {club.close_time.slice(0, 5)}
            </span>
          </div>
          {club.instagram && (
            <a
              href={club.instagram}
              target="_blank"
              rel="noopener"
              className="mt-1 inline-flex w-fit items-center gap-1 text-xs text-[var(--color-brand-300)] hover:underline"
            >
              <Instagram className="h-3 w-3" />
              {club.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, "@")}
            </a>
          )}
        </div>
      </header>

      {paused && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-4 text-sm">
          ⏸ Клуб временно не принимает онлайн-брони
        </div>
      )}

      {club.description && (
        <p className="text-sm text-[var(--color-fg-muted)]">{club.description}</p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
          Зоны и тарифы
        </h2>
        <div className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <div
              key={z.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elev)] px-3 py-1.5 text-sm"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: z.color }} />
              <span className="font-medium">{z.name}</span>
              <span className="text-[var(--color-fg-muted)]">
                {formatTenge(z.price_per_hour)}/ч
              </span>
            </div>
          ))}
          {zones.length === 0 && (
            <Badge variant="outline">Зоны ещё не настроены</Badge>
          )}
        </div>
      </section>

      <SlotPicker value={slot} onChange={setSlot} timezone={club.timezone} />

      <ClubMap
        clubId={club.id}
        stations={stations}
        zones={zones}
        map={map}
        slot={slot}
        selected={selected}
        onToggle={(s) => {
          setSelected((prev) =>
            prev.find((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s],
          );
        }}
        disabled={paused}
      />

      {selected.length > 0 && !paused && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] glass p-3 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col">
              <span className="text-xs text-[var(--color-fg-muted)]">
                {selected.length} ПК · {hours.toFixed(1)} ч
              </span>
              <span className="text-lg font-bold tracking-tight">{formatTenge(total)}</span>
            </div>
            <Button size="lg" onClick={() => setSheetOpen(true)}>
              Забронировать
            </Button>
          </div>
        </div>
      )}

      <BookingSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        clubId={club.id}
        clubSlug={club.slug}
        stations={selected}
        zoneById={zoneById}
        slot={slot}
        total={total}
      />
    </div>
  );
}

function defaultSlot() {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const end = new Date(now);
  end.setHours(end.getHours() + 2);
  return { from: now.toISOString(), to: end.toISOString() };
}
