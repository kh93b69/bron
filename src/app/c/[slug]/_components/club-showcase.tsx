"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Clock, MapPin, Phone, Sparkles } from "lucide-react";
import { formatTenge, hoursBetween } from "@/lib/utils";
import { SlotPicker } from "./slot-picker";
import { ClubMap } from "./club-map";
import { BookingSheet } from "./booking-sheet";

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
    <div className="flex flex-col gap-6">
      {club.cover_url && (
        <div className="relative h-40 w-full overflow-hidden rounded-2xl sm:h-56">
          <Image src={club.cover_url} alt={club.name} fill className="object-cover" priority />
        </div>
      )}

      <header className="flex items-start gap-4">
        {club.logo_url ? (
          <Image
            src={club.logo_url}
            alt={club.name}
            width={56}
            height={56}
            className="h-14 w-14 rounded-xl border border-border object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border text-lg font-bold">
            {club.name[0]}
          </div>
        )}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{club.name}</h1>
          <p className="flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]">
            <MapPin className="h-3.5 w-3.5" /> {club.city}, {club.address}
          </p>
          <p className="flex items-center gap-1 text-sm text-[color:var(--muted-foreground)]">
            <Clock className="h-3.5 w-3.5" /> {club.open_time.slice(0, 5)} — {club.close_time.slice(0, 5)}
          </p>
        </div>
      </header>

      {paused && (
        <div className="rounded-lg border border-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10 p-3 text-sm">
          Клуб временно не принимает онлайн-брони
        </div>
      )}

      {club.description && (
        <p className="text-sm text-[color:var(--muted-foreground)]">{club.description}</p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" /> Зоны
        </h2>
        <div className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <div
              key={z.id}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm"
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: z.color }} />
              <span className="font-medium">{z.name}</span>
              <span className="text-[color:var(--muted-foreground)]">
                {formatTenge(z.price_per_hour)}/ч
              </span>
            </div>
          ))}
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
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-xl border border-border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col">
            <span className="text-xs text-[color:var(--muted-foreground)]">
              {selected.length} ПК · {hours.toFixed(1)} ч
            </span>
            <span className="text-lg font-semibold">{formatTenge(total)}</span>
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-brand-500)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-brand-600)]"
          >
            Забронировать
          </button>
        </div>
      )}

      <div className="mt-8 flex items-center gap-2 text-sm text-[color:var(--muted-foreground)]">
        <Phone className="h-3.5 w-3.5" />
        <span>Нужна помощь? Напиши клубу напрямую в Instagram</span>
      </div>

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
