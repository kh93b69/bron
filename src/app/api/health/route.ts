import { NextResponse } from "next/server";

/**
 * Health check для Railway healthcheckPath.
 * Возвращает 200 без обращения к БД — чтобы на cold start не падать.
 */
export async function GET() {
  return NextResponse.json({ ok: true, service: "cyberbook", at: new Date().toISOString() });
}

export const runtime = "nodejs";
