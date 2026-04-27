import { createClient } from "@/lib/supabase/server";
import { TodayBoard } from "./_components/today-board";

export const dynamic = "force-dynamic";

export default async function TodayBoardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: memberships } = await supabase
    .from("club_members")
    .select("club_id, clubs(name)")
    .eq("user_id", user.id)
    .limit(1);
  const club = memberships?.[0];
  if (!club) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { data: initial } = await supabase
    .from("bookings")
    .select(
      "id, booking_code, user_id, starts_at, ends_at, status, total_amount, notes, guest_name, guest_phone, users(full_name, email, phone), booking_stations(station_id, stations(name))",
    )
    .eq("club_id", club.club_id)
    .gte("starts_at", startOfDay.toISOString())
    .lt("starts_at", endOfDay.toISOString())
    .order("starts_at", { ascending: true });

  const clubName = Array.isArray(club.clubs)
    ? (club.clubs[0]?.name ?? "")
    : (club.clubs?.name ?? "");

  return (
    <TodayBoard
      clubId={club.club_id}
      clubName={clubName}
      initial={(initial ?? []) as unknown as Parameters<typeof TodayBoard>[0]["initial"]}
    />
  );
}
