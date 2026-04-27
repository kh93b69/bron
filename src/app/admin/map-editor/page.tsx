import { requireCurrentClub } from "@/server/clubs/current";
import { MapEditor } from "./_components/map-editor";

export const dynamic = "force-dynamic";

export default async function MapEditorPage() {
  const { supabase, club } = await requireCurrentClub();

  const [{ data: stations }, { data: zones }, { data: map }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, zone_id, position_x, position_y, status")
      .eq("club_id", club.id)
      .order("name"),
    supabase
      .from("zones")
      .select("id, name, color")
      .eq("club_id", club.id)
      .order("sort_order"),
    supabase
      .from("club_maps")
      .select("layout, version")
      .eq("club_id", club.id)
      .maybeSingle(),
  ]);

  return (
    <MapEditor
      clubId={club.id}
      clubSlug={club.slug}
      stations={(stations ?? []) as Station[]}
      zones={(zones ?? []) as Zone[]}
      layout={(map?.layout ?? null) as Layout | null}
      version={map?.version ?? 1}
    />
  );
}

type Station = {
  id: string;
  name: string;
  zone_id: string;
  position_x: number;
  position_y: number;
  status: "active" | "maintenance" | "retired";
};
type Zone = { id: string; name: string; color: string };
type Layout = {
  gridW: number;
  gridH: number;
  cellSize?: number;
  labels?: Array<{ x: number; y: number; text: string }>;
} | null;
