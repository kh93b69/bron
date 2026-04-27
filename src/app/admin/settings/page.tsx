import { requireCurrentClub } from "@/server/clubs/current";
import { ClubSettings } from "./_components/club-settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { supabase, club, role } = await requireCurrentClub();

  const { data: full } = await supabase
    .from("clubs")
    .select(
      "id, slug, name, city, address, contact_phone, instagram, description, timezone, open_time, close_time, logo_url, cover_url, status, subscription_plan",
    )
    .eq("id", club.id)
    .single();

  if (!full) return null;

  return <ClubSettings club={full} role={role} />;
}
