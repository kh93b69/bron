"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { formatTenge } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateBookingDialog } from "./create-booking-dialog";

type Booking = {
  id: string;
  booking_code: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_amount: number;
  guest_name: string | null;
  guest_phone: string | null;
  users: { full_name: string | null; email: string; phone: string | null } | null;
  booking_stations: Array<{ station_id: string; stations: { name: string } | null }>;
};
type Zone = { id: string; name: string; color: string; price_per_hour: number };
type Station = { id: string; name: string; zone_id: string; status: string };

const STATUS_LABEL: Record<string, { label: string; variant: "brand" | "success" | "warning" | "danger" | "info" | "default" }> = {
  pending: { label: "ожидает", variant: "warning" },
  confirmed: { label: "подтверждена", variant: "info" },
  checked_in: { label: "в игре", variant: "success" },
  completed: { label: "завершена", variant: "default" },
  cancelled: { label: "отменена", variant: "default" },
  no_show: { label: "не пришёл", variant: "danger" },
};

export function BookingsView({
  clubId,
  bookings,
  zones,
  stations,
  filters,
}: {
  clubId: string;
  bookings: Booking[];
  zones: Zone[];
  stations: Station[];
  filters: { date?: string; status?: string; q?: string };
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Брони</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {bookings.length} результатов · подтверждение по коду CB-… на ресепшене
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={stations.length === 0}>
          <Plus className="h-4 w-4" /> Создать бронь
        </Button>
      </header>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <FilterField label="Дата">
            <input
              type="date"
              name="date"
              defaultValue={filters.date}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Статус">
            <select
              name="status"
              defaultValue={filters.status ?? ""}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
            >
              <option value="">Все</option>
              <option value="confirmed">Подтверждена</option>
              <option value="checked_in">В игре</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
              <option value="no_show">No-show</option>
            </select>
          </FilterField>
          <FilterField label="Поиск" className="flex-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-fg-subtle)]" />
              <input
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="код CB-..., имя или телефон"
                className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] pl-8 pr-3 text-sm"
              />
            </div>
          </FilterField>
          <Button type="submit" variant="outline" size="sm">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Применить
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-elev-2)] text-[10px] uppercase tracking-wider text-[var(--color-fg-subtle)]">
              <tr>
                <Th>Время</Th>
                <Th>Гость</Th>
                <Th>Места</Th>
                <Th>Код</Th>
                <Th>Сумма</Th>
                <Th>Статус</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[var(--color-fg-muted)]">
                    Нет броней под этот фильтр
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const s = STATUS_LABEL[b.status] ?? { label: b.status, variant: "default" as const };
                  const guestName =
                    b.users?.full_name ??
                    b.guest_name ??
                    b.users?.email?.split("@")[0] ??
                    "—";
                  const guestContact = b.users?.phone ?? b.guest_phone ?? b.users?.email ?? "";
                  return (
                    <tr key={b.id} className="transition hover:bg-[var(--color-bg-elev-2)]/50">
                      <Td>
                        <div className="font-mono text-sm">
                          {new Date(b.starts_at).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <div className="font-medium">{guestName}</div>
                          {!b.users && b.guest_name && (
                            <Badge variant="outline" className="text-[9px]">walk-in</Badge>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-fg-subtle)]">{guestContact}</div>
                      </Td>
                      <Td>
                        {b.booking_stations
                          .map((bs) => bs.stations?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </Td>
                      <Td>
                        <span className="rounded-md bg-[var(--color-bg-elev-2)] px-2 py-0.5 font-mono text-xs">
                          {b.booking_code}
                        </span>
                      </Td>
                      <Td className="font-medium">{formatTenge(b.total_amount)}</Td>
                      <Td>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {creating && (
        <CreateBookingDialog
          open
          onOpenChange={setCreating}
          clubId={clubId}
          zones={zones}
          stations={stations}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left font-medium">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-fg-subtle)]">
        {label}
      </span>
      {children}
    </div>
  );
}
