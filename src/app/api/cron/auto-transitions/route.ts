import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron-эндпоинт для Railway Scheduled Jobs / Supabase pg_cron.
 * Запускать раз в 15 минут.
 *
 * Защита: заголовок `x-cron-secret` должен совпадать с env CRON_SECRET.
 */
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env.CRON_SECRET || request.headers.get("x-cron-secret") !== env.CRON_SECRET) {
    return NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("run_auto_status_transitions");
  if (error) {
    console.error("[cron/auto-transitions]", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
  return NextResponse.json({ data });
}
