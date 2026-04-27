import { requireCurrentClub } from "@/server/clubs/current";
import { ZonesManager } from "./_components/zones-manager";

export const dynamic = "force-dynamic";

export default async function ZonesPage() {
  const { supabase, club } = await requireCurrentClub();

  const { data: zones } = await supabase
    .from("zones")
    .select("id, name, color, price_per_hour, sort_order, description")
    .eq("club_id", club.id)
    .order("sort_order", { ascending: true });

  return <ZonesManager clubId={club.id} initial={(zones ?? []) as Zone[]} />;
}

type Zone = {
  id: string;
  name: string;
  color: string;
  price_per_hour: number;
  sort_order: number;
  description: string | null;
};
