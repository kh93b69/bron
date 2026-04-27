import { requireCurrentClub } from "@/server/clubs/current";
import { BookingsView } from "./_components/bookings-view";

export const dynamic = "force-dynamic";

type SearchParams = { date?: string; status?: string; q?: string };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { date, status, q } = await searchParams;
  const { supabase, club } = await requireCurrentClub();

  let query = supabase
    .from("bookings")
    .select(
      "id, booking_code, starts_at, ends_at, status, total_amount, guest_name, guest_phone, users(full_name, email, phone), booking_stations(station_id, stations(name))",
    )
    .eq("club_id", club.id)
    .order("starts_at", { ascending: false })
    .limit(100);

  if (date) {
    const from = new Date(date + "T00:00:00Z");
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    query = query.gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString());
  }
  if (status) query = query.eq("status", status);
  if (q) {
    // Поиск по booking_code, email user'а, guest_name, guest_phone
    query = query.or(`booking_code.ilike.%${q}%,guest_name.ilike.%${q}%,guest_phone.ilike.%${q}%`);
  }

  const { data: bookings } = await query;

  // Зоны и активные станции для диалога создания брони
  const [{ data: zones }, { data: stations }] = await Promise.all([
    supabase
      .from("zones")
      .select("id, name, color, price_per_hour")
      .eq("club_id", club.id)
      .order("sort_order"),
    supabase
      .from("stations")
      .select("id, name, zone_id, status")
      .eq("club_id", club.id)
      .eq("status", "active")
      .order("name"),
  ]);

  return (
    <BookingsView
      clubId={club.id}
      bookings={(bookings ?? []) as Booking[]}
      zones={(zones ?? []) as Zone[]}
      stations={(stations ?? []) as Station[]}
      filters={{ date, status, q }}
    />
  );
}

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
