-- ============================================================================
-- Walk-in бронирование: гость пришёл лично, у него нет аккаунта.
-- Админ заводит бронь руками — указывает имя+телефон, система создаёт
-- bookings без user_id, с полями guest_name/guest_phone.
-- ============================================================================

BEGIN;

-- 1) bookings.user_id становится nullable, добавляем guest_name + guest_phone
ALTER TABLE public.bookings
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name  text,
  ADD COLUMN IF NOT EXISTS guest_phone text;

-- Минимум одно из (user_id, guest_name) должно быть заполнено
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_owner_required
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL);

-- 2) RLS: при walk-in без user_id запись принадлежит клубу — видна только staff
DROP POLICY IF EXISTS bookings_select_owner_or_staff ON public.bookings;
CREATE POLICY bookings_select_owner_or_staff ON public.bookings
  FOR SELECT USING (
    (user_id IS NOT NULL AND user_id = auth.uid())
    OR public.is_club_member(club_id)
  );

-- 3) admin_create_booking — SECURITY DEFINER, без 5-min ограничения, поддерживает
-- walk-in (без user_id) и привязку к существующему user (по user_id).
CREATE OR REPLACE FUNCTION public.admin_create_booking(
  p_club_id     uuid,
  p_station_ids uuid[],
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_guest_name  text DEFAULT NULL,
  p_guest_phone text DEFAULT NULL,
  p_notes       text DEFAULT NULL
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_booking public.bookings;
  v_code text;
  v_total integer := 0;
  v_hours numeric;
  v_overlap_count integer;
  v_station_count integer;
  v_zone public.zones;
  v_station_id uuid;
  v_price integer;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_club_member(p_club_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_starts_at >= p_ends_at THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING MESSAGE = 'ends_at must be after starts_at';
  END IF;

  IF p_ends_at - p_starts_at > interval '24 hours' THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING MESSAGE = 'duration too long';
  END IF;

  IF array_length(p_station_ids, 1) IS NULL OR array_length(p_station_ids, 1) > 20 THEN
    RAISE EXCEPTION 'INVALID_STATIONS' USING MESSAGE = 'station_ids 1..20';
  END IF;

  -- Стейшены принадлежат клубу
  SELECT count(*) INTO v_station_count
  FROM public.stations
  WHERE id = ANY(p_station_ids) AND club_id = p_club_id AND status = 'active';
  IF v_station_count <> array_length(p_station_ids, 1) THEN
    RAISE EXCEPTION 'INVALID_STATIONS' USING MESSAGE = 'stations must belong to club';
  END IF;

  -- Overlap-проверка
  PERFORM 1 FROM public.booking_stations bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.station_id = ANY(p_station_ids)
    AND b.status IN ('pending','confirmed','checked_in')
    AND b.starts_at < p_ends_at AND b.ends_at > p_starts_at
  FOR UPDATE;

  SELECT count(*) INTO v_overlap_count
  FROM public.booking_stations bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.station_id = ANY(p_station_ids)
    AND b.status IN ('pending','confirmed','checked_in')
    AND b.starts_at < p_ends_at AND b.ends_at > p_starts_at;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'BOOKING_SLOT_OCCUPIED' USING MESSAGE = 'slot is taken';
  END IF;

  -- Цена
  v_hours := EXTRACT(EPOCH FROM (p_ends_at - p_starts_at)) / 3600.0;
  FOR v_station_id IN SELECT unnest(p_station_ids) LOOP
    SELECT z.* INTO v_zone
    FROM public.stations s JOIN public.zones z ON z.id = s.zone_id
    WHERE s.id = v_station_id;
    v_total := v_total + (v_zone.price_per_hour * v_hours)::integer;
  END LOOP;

  -- Code
  LOOP
    v_code := 'CB-' || upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE booking_code = v_code);
  END LOOP;

  -- INSERT booking (walk-in: user_id = NULL)
  INSERT INTO public.bookings (
    booking_code, user_id, club_id, starts_at, ends_at, status, total_amount,
    is_group, notes, guest_name, guest_phone
  ) VALUES (
    v_code, NULL, p_club_id, p_starts_at, p_ends_at, 'confirmed', v_total,
    array_length(p_station_ids, 1) > 1, p_notes, p_guest_name, p_guest_phone
  ) RETURNING * INTO v_booking;

  FOR v_station_id IN SELECT unnest(p_station_ids) LOOP
    SELECT z.price_per_hour INTO v_price
    FROM public.stations s JOIN public.zones z ON z.id = s.zone_id
    WHERE s.id = v_station_id;
    INSERT INTO public.booking_stations (booking_id, station_id, price_amount)
    VALUES (v_booking.id, v_station_id, (v_price * v_hours)::integer);
  END LOOP;

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id, payload)
  VALUES (v_admin, p_club_id, 'booking.admin_create', 'booking', v_booking.id,
          jsonb_build_object('guest', jsonb_build_object('name', p_guest_name, 'phone', p_guest_phone),
                             'stations', p_station_ids, 'total', v_total));

  RETURN v_booking;
END; $$;

REVOKE ALL ON FUNCTION public.admin_create_booking FROM public;
GRANT EXECUTE ON FUNCTION public.admin_create_booking TO authenticated;

-- 4) apply_reputation_event с поправкой: для walk-in не пытаемся обновить
-- user_reputation если user_id IS NULL.
CREATE OR REPLACE FUNCTION public.apply_reputation_event(p_user uuid, p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;  -- walk-in без user_id — нет репутации, скип
  END IF;

  CASE p_event
    WHEN 'completed' THEN
      UPDATE public.user_reputation
      SET score = LEAST(score + 5, 100), total_bookings = total_bookings + 1
      WHERE user_id = p_user;
    WHEN 'cancel_late' THEN
      UPDATE public.user_reputation
      SET score = score - 15, cancellations = cancellations + 1
      WHERE user_id = p_user;
    WHEN 'no_show' THEN
      UPDATE public.user_reputation
      SET score = score - 30, no_shows = no_shows + 1,
          banned_until = CASE
            WHEN no_shows + 1 >= 2 THEN now() + interval '7 days'
            ELSE banned_until
          END
      WHERE user_id = p_user;
    ELSE
      RAISE EXCEPTION 'Unknown reputation event: %', p_event;
  END CASE;
END; $$;

COMMIT;
