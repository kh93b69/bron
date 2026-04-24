import { createClient } from "@/lib/supabase/server";
import { formatTenge } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Search = { date?: string; status?: string; q?: string };

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

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-bold">Брони</h1>

      <form className="flex flex-wrap gap-2 text-sm">
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-md border border-border bg-background px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-border bg-background px-3 py-1.5"
        >
          <option value="">Все статусы</option>
          <option value="confirmed">Подтверждена</option>
          <option value="checked_in">В игре</option>
          <option value="completed">Завершена</option>
          <option value="cancelled">Отменена</option>
          <option value="no_show">No-show</option>
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="код или email"
          className="rounded-md border border-border bg-background px-3 py-1.5"
        />
        <button
          type="submit"
          className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
        >
          Фильтр
        </button>
      </form>

      <div className="overflow-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-[color:var(--muted-foreground)]">
            <tr>
              <Th>Время</Th>
              <Th>Гость</Th>
              <Th>Места</Th>
              <Th>Код</Th>
              <Th>Сумма</Th>
              <Th>Статус</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(bookings ?? []).map((b) => (
              <tr key={b.id}>
                <Td>
                  {new Date(b.starts_at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td>
                  <div className="font-medium">{b.users?.full_name ?? "—"}</div>
                  <div className="text-xs text-[color:var(--muted-foreground)]">
                    {b.users?.phone ?? b.users?.email}
                  </div>
                </Td>
                <Td>
                  {b.booking_stations.map((bs) => bs.stations?.name).filter(Boolean).join(", ")}
                </Td>
                <Td className="font-mono text-xs">{b.booking_code}</Td>
                <Td>{formatTenge(b.total_amount)}</Td>
                <Td>{b.status}</Td>
              </tr>
            ))}
            {bookings?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[color:var(--muted-foreground)]">
                  Нет броней под этот фильтр
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-left">{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
