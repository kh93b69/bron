import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Получить текущего user'а + его клуб (где он owner/admin) для server-компонент
 * админки. Если не аутентифицирован → /login. Если нет клуба → /onboarding/club.
 */
export async function requireCurrentClub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: memberships } = await supabase
    .from("club_members")
    .select("role, club_id, clubs(id, name, slug, subscription_plan)")
    .eq("user_id", user.id)
    .limit(1);

  const m = memberships?.[0];
  if (!m) redirect("/onboarding/club");

  const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
  if (!club) redirect("/onboarding/club");

  return {
    supabase,
    user,
    role: m.role as "owner" | "admin",
    club: {
      id: club.id as string,
      name: club.name as string,
      slug: club.slug as string,
      plan: (club.subscription_plan as string) ?? "free",
    },
  };
}
