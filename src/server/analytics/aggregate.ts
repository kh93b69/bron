import { createClient } from "@/lib/supabase/server";

export type Range = { from: Date; to: Date };

export function rangeLast(days: number): Range {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(to.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  total_amount: number;
  user_id: string | null;
  guest_phone: string | null;
  booking_stations: Array<{ station_id: string; price_amount: number; stations: { name: string } | null }>;
};

export async function loadAnalytics(clubId: string, range: Range) {
  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, total_amount, user_id, guest_phone, booking_stations(station_id, price_amount, stations(name))",
    )
    .eq("club_id", clubId)
    .gte("starts_at", range.from.toISOString())
    .lte("starts_at", range.to.toISOString())
    .in("status", ["confirmed", "checked_in", "completed"]);

  const list = (bookings ?? []) as BookingRow[];

  // Active stations count for occupancy denominator
  const { count: activeStations } = await supabase
    .from("stations")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "active");

  return aggregate(list, activeStations ?? 0, range);
}

export type Analytics = {
  totals: {
    bookings: number;
    revenue: number;
    avgCheck: number;
    uniqueGuests: number;
    completionRate: number;
  };
  revenueByDay: Array<{ date: string; revenue: number; bookings: number }>;
  occupancyHeatmap: number[][]; // [weekday 0..6][hour 0..23] = ratio 0..1
  topStations: Array<{ station_id: string; name: string; count: number; revenue: number }>;
  statusBreakdown: Record<string, number>;
};

function aggregate(rows: BookingRow[], activeStations: number, range: Range): Analytics {
  // 1. Totals
  const revenue = rows.reduce((s, b) => s + b.total_amount, 0);
  const guestKeys = new Set<string>();
  for (const b of rows) guestKeys.add(b.user_id ?? `phone:${b.guest_phone ?? b.id}`);
  const completed = rows.filter((b) => b.status === "completed").length;

  // 2. Revenue by day
  const byDay = new Map<string, { revenue: number; bookings: number }>();
  for (const b of rows) {
    const key = b.starts_at.slice(0, 10);
    const cur = byDay.get(key) ?? { revenue: 0, bookings: 0 };
    cur.revenue += b.total_amount;
    cur.bookings += 1;
    byDay.set(key, cur);
  }
  // Заполняем пробелы — дни без броней
  const daySeries: Array<{ date: string; revenue: number; bookings: number }> = [];
  const cursor = new Date(range.from);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= range.to) {
    const key = cursor.toISOString().slice(0, 10);
    const v = byDay.get(key) ?? { revenue: 0, bookings: 0 };
    daySeries.push({ date: key, ...v });
    cursor.setDate(cursor.getDate() + 1);
  }

  // 3. Heatmap: weekday × hour. Каждая бронь раскидывается по часам, в которые
  // она попадает. Знаменатель — activeStations (полностью заполненный час = 1).
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const heatmapHours: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

  for (const b of rows) {
    const start = new Date(b.starts_at);
    const end = new Date(b.ends_at);
    const stations = b.booking_stations.length || 1;
    const cur = new Date(start);
    cur.setMinutes(0, 0, 0);
    while (cur < end) {
      const wd = (cur.getDay() + 6) % 7; // понедельник=0
      const hr = cur.getHours();
      heatmap[wd][hr] += stations; // станций * часов вклад
      heatmapHours[wd][hr] += 1;
      cur.setHours(cur.getHours() + 1);
    }
  }

  // Нормализуем в долю занятости (0..1)
  // Каждая ячейка hour-кокретного weekday присутствует ~ rangeDays / 7 раз
  const rangeDays = Math.max(1, daySeries.length);
  const denom = activeStations * (rangeDays / 7);
  const heatmapNorm = heatmap.map((row) =>
    row.map((v) => (denom > 0 ? Math.min(1, v / denom) : 0)),
  );

  // 4. Top stations
  const stationStats = new Map<string, { name: string; count: number; revenue: number }>();
  for (const b of rows) {
    for (const bs of b.booking_stations) {
      const cur = stationStats.get(bs.station_id) ?? { name: bs.stations?.name ?? "—", count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += bs.price_amount;
      stationStats.set(bs.station_id, cur);
    }
  }
  const topStations = Array.from(stationStats.entries())
    .map(([station_id, v]) => ({ station_id, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // 5. Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const b of rows) {
    statusBreakdown[b.status] = (statusBreakdown[b.status] ?? 0) + 1;
  }

  return {
    totals: {
      bookings: rows.length,
      revenue,
      avgCheck: rows.length > 0 ? Math.round(revenue / rows.length) : 0,
      uniqueGuests: guestKeys.size,
      completionRate: rows.length > 0 ? completed / rows.length : 0,
    },
    revenueByDay: daySeries,
    occupancyHeatmap: heatmapNorm,
    topStations,
    statusBreakdown,
  };
}
