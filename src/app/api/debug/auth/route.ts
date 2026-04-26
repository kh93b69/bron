import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Diagnostic-only endpoint. Возвращает что сервер видит про текущего user.
 * Используется чтобы понять, почему /admin/layout редиректит на /onboarding
 * (нет ли membership с точки зрения server). Удалить после починки.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({
      stage: "no-user",
      user: null,
      userError: userErr?.message ?? null,
      hint: "куки sb-*-auth-token не дошли до server",
    });
  }

  // 1) RLS-путь: то, что увидит /admin/layout
  const rlsResult = await supabase
    .from("club_members")
    .select("club_id, role, clubs(id, name, slug)")
    .eq("user_id", user.id);

  // 2) Service-role bypass: что реально лежит в БД
  const service = createServiceClient();
  const svcByUserId = await service
    .from("club_members")
    .select("club_id, role, clubs(id, name, slug)")
    .eq("user_id", user.id);

  const svcByEmail = await service.from("users").select("id, email").eq("email", user.email!);

  return NextResponse.json({
    stage: "ok",
    server_sees: {
      user_id: user.id,
      email: user.email,
    },
    rls_select_club_members: {
      rows: rlsResult.data,
      error: rlsResult.error?.message ?? null,
    },
    service_select_club_members_by_uid: {
      rows: svcByUserId.data,
      error: svcByUserId.error?.message ?? null,
    },
    service_users_by_email: {
      rows: svcByEmail.data,
      error: svcByEmail.error?.message ?? null,
    },
  });
}
