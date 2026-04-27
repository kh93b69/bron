import { requireCurrentClub } from "@/server/clubs/current";
import { StationsManager } from "./_components/stations-manager";

export const dynamic = "force-dynamic";

export default async function StationsPage() {
  const { supabase, club } = await requireCurrentClub();

  const [{ data: stations }, { data: zones }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, zone_id, name, position_x, position_y, status, specs")
      .eq("club_id", club.id)
      .order("name", { ascending: true }),
    supabase
      .from("zones")
      .select("id, name, color, price_per_hour, sort_order")
      .eq("club_id", club.id)
      .order("sort_order", { ascending: true }),
  ]);

  return (
    <StationsManager
      clubId={club.id}
      initialStations={(stations ?? []) as Station[]}
      zones={(zones ?? []) as Zone[]}
    />
  );
}

type Station = {
  id: string;
  zone_id: string;
  name: string;
  position_x: number;
  position_y: number;
  status: "active" | "maintenance" | "retired";
  specs: Record<string, unknown> | null;
};
type Zone = { id: string; name: string; color: string; price_per_hour: number; sort_order: number };
