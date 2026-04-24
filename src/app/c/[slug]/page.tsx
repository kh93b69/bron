import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClubShowcase } from "./_components/club-showcase";

export const revalidate = 30;

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: club } = await supabase
    .from("clubs")
    .select("id, slug, name, city, address, timezone, open_time, close_time, logo_url, cover_url, description, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!club || club.status === "archived") notFound();

  const [{ data: zones }, { data: stations }, { data: map }] = await Promise.all([
    supabase
      .from("zones")
      .select("id, name, color, price_per_hour, sort_order")
      .eq("club_id", club.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("stations")
      .select("id, name, zone_id, position_x, position_y, specs, status")
      .eq("club_id", club.id),
    supabase.from("club_maps").select("layout, version").eq("club_id", club.id).maybeSingle(),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6">
      <ClubShowcase
        club={club}
        zones={zones ?? []}
        stations={stations ?? []}
        map={map?.layout ?? null}
        paused={club.status === "paused"}
      />
    </main>
  );
}
