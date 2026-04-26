import { Search, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type Search = { date?: string; status?: string; q?: string };

const STATUS_LABEL: Record<string, { label: string; variant: "brand" | "success" | "warning" | "danger" | "info" | "default" }> = {
  pending: { label: "ожидает", variant: "warning" },
  confirmed: { label: "подтверждена", variant: "info" },
  checked_in: { label: "в игре", variant: "success" },
  completed: { label: "завершена", variant: "default" },
  cancelled: { label: "отменена", variant: "default" },
  no_show: { label: "не пришёл", variant: "danger" },
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { date, status, q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id")
    .eq("user_id", user.id)
    .limit(1);
  const clubId = memberships?.[0]?.club_id;
  if (!clubId) return null;

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, starts_at, ends_at, status, total_amount, users(full_name, email, phone), booking_stations(station_id, stations(name))",
    )
    .eq("club_id", clubId)
    .order("starts_at", { ascending: false })
    .limit(100);

  if (date) {
    const from = new Date(date + "T00:00:00Z");
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    query = query.gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString());
  }
  if (status) query = query.eq("status", status);
  if (q) query = query.or(`booking_code.ilike.%${q}%,users.email.ilike.%${q}%`);

  const { data: bookings } = await query;
  const list = bookings ?? [];

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Брони</h1>
        <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
          {list.length} результатов · Покажи QR-код или код брони на ресепшене для check-in
        </p>
      </header>

      <Card className="p-4">
        <form className="flex flex-wrap items-end gap-3">
          <FilterField label="Дата">
            <input
              type="date"
              name="date"
              defaultValue={date}
              className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg-elev-2)] px-3 text-sm"
            />
          </FilterField>
          <FilterField label="Статус">
            <select
              name="status"
              defaultValue={status ?? ""}
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
                defaultValue={q}
                placeholder="код CB-... или email клиента"
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
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[var(--color-fg-muted)]">
                    Нет броней под этот фильтр
                  </td>
                </tr>
              ) : (
                list.map((b) => {
                  const s = STATUS_LABEL[b.status] ?? { label: b.status, variant: "default" as const };
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
                        <div className="font-medium">{b.users?.full_name ?? "—"}</div>
                        <div className="text-xs text-[var(--color-fg-subtle)]">
                          {b.users?.phone ?? b.users?.email}
                        </div>
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
