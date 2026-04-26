import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "./_components/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: memberships } = await supabase
    .from("club_members")
    .select("role, club_id, clubs(id, name, slug, subscription_plan)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding/club");
  }

  // supabase-js может вернуть clubs как массив (FK-relationship неоднозначность);
  // нормализуем к одиночному объекту.
  const m = memberships[0]!;
  const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs;
  if (!club) redirect("/onboarding/club");

  return (
    <AdminShell
      club={{
        id: club.id,
        name: club.name,
        slug: club.slug,
        plan: club.subscription_plan ?? "free",
      }}
      me={{ email: user.email!, role: m.role as "owner" | "admin" }}
    >
      {children}
    </AdminShell>
  );
}
