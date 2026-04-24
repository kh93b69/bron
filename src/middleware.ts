import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

/**
 * Matcher — только приватные пути, требующие обновления Supabase-сессии.
 * Публичные (/, /login, /c/[slug], статика, healthcheck) проходят мимо
 * middleware и не делают лишний HTTP-запрос к Supabase на каждый request.
 * Server-компоненты внутри защищённых путей сами вызывают supabase.auth.getUser().
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/my/:path*",
    "/onboarding/:path*",
    "/api/admin/:path*",
    "/api/bookings/:path*",
  ],
};
