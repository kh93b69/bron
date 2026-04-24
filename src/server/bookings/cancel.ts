import { createClient } from "@/lib/supabase/server";
import { AppErrors, toAppError } from "@/server/errors";

export async function cancelBooking(bookingId: string, reason?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppErrors.unauthorized();

  const { data, error } = await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: reason ?? null,
  });

  if (error) throw toAppError(error);
  return data;
}

export async function checkInBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppErrors.unauthorized();

  const { data, error } = await supabase.rpc("check_in_booking", { p_booking_id: bookingId });
  if (error) throw toAppError(error);
  return data;
}

export async function markNoShow(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw AppErrors.unauthorized();

  const { data, error } = await supabase.rpc("mark_no_show", { p_booking_id: bookingId });
  if (error) throw toAppError(error);
  return data;
}
