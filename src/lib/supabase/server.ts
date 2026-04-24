import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv, serverEnv } from "@/lib/env";

type CookiePayload = { name: string; value: string; options: CookieOptions };

/**
 * Server Component / Server Action / Route Handler клиент.
 * Читает сессию из cookies, RLS срабатывает от имени user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookiePayload[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: CookiePayload) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // В Server Component set() бросает — это ок, middleware уже обновил куки.
          }
        },
      },
    },
  );
}

/**
 * Service-role клиент — обходит RLS. Использовать ТОЛЬКО:
 *  - в серверных функциях-хелперах (audit, reputation, notifications worker)
 *  - в cron-endpoint'ах
 *  - никогда из компонента страницы
 */
export function createServiceClient() {
  const env = serverEnv();
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
