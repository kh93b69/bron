import { createClient } from "@/lib/supabase/server";
import { AppErrors, toAppError } from "@/server/errors";
import type { CreateBookingInput } from "./schemas";

/**
 * Создать бронь. Вся критическая логика (overlap + FOR UPDATE + расчёт цены +
 * audit + notifications) живёт в SECURITY DEFINER функции public.create_booking.
 * Здесь — авторизация + вызов RPC + нормализация ошибок.
 */
export async function createBooking(input: CreateBookingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw AppErrors.unauthorized();

  const { data, error } = await supabase.rpc("create_booking", {
    p_club_id: input.club_id,
    p_station_ids: input.station_ids,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_notes: input.notes ?? null,
  });

  if (error) throw toAppError(error);
  return data as unknown as {
    id: string;
    booking_code: string;
    starts_at: string;
    ends_at: string;
    total_amount: number;
    status: string;
  };
}
