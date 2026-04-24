import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { publicEnv } from "@/lib/env";

type CookiePayload = { name: string; value: string; options: CookieOptions };

/**
 * Обновляет сессию Supabase в каждом запросе: RSC всегда видит свежие куки.
 * Вызывается из src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookiePayload[]) {
          cookiesToSet.forEach(({ name, value }: CookiePayload) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: CookiePayload) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Обновить токен. НЕ УДАЛЯТЬ — иначе RLS отвалится после refresh.
  await supabase.auth.getUser();

  return response;
}
