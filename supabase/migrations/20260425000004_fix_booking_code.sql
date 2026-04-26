-- ============================================================================
-- Фикс: gen_random_bytes() недоступен из public.create_booking из-за
-- search_path. Переписываем генерацию booking_code через gen_random_uuid(),
-- который всегда в core PostgreSQL и не требует pgcrypto в search_path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_booking(
  p_club_id     uuid,
  p_station_ids uuid[],
  p_starts_at   timestamptz,
  p_ends_at     timestamptz,
  p_notes       text DEFAULT NULL
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_booking    public.bookings;
  v_code       text;
  v_total      integer := 0;
  v_hours      numeric;
  v_banned_until timestamptz;
  v_overlap_count integer;
  v_station_count integer;
  v_zone        public.zones;
  v_station_id  uuid;
  v_price       integer;
  v_active_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_starts_at >= p_ends_at THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING MESSAGE = 'ends_at must be after starts_at';
  END IF;

  IF p_ends_at - p_starts_at < interval '1 hour' OR p_ends_at - p_starts_at > interval '12 hours' THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING MESSAGE = 'duration must be 1..12 hours';
  END IF;

  IF p_starts_at < now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'INVALID_SLOT' USING MESSAGE = 'booking too close to now';
  END IF;

  IF array_length(p_station_ids, 1) IS NULL OR array_length(p_station_ids, 1) > 10 THEN
    RAISE EXCEPTION 'INVALID_STATIONS' USING MESSAGE = 'station_ids must contain 1..10 items';
  END IF;

  -- Проверка бана
  SELECT banned_until INTO v_banned_until FROM public.user_reputation WHERE user_id = v_user;
  IF v_banned_until IS NOT NULL AND v_banned_until > now() THEN
    RAISE EXCEPTION 'USER_BANNED' USING MESSAGE = v_banned_until::text;
  END IF;

  -- Лимит активных будущих броней на user
  SELECT count(*) INTO v_active_count
  FROM public.bookings
  WHERE user_id = v_user
    AND status IN ('pending','confirmed','checked_in')
    AND ends_at > now();
  IF v_active_count >= 10 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING MESSAGE = 'too many active bookings';
  END IF;

  -- Все station_ids принадлежат одному клубу и активны
  SELECT count(*) INTO v_station_count
  FROM public.stations
  WHERE id = ANY(p_station_ids) AND club_id = p_club_id AND status = 'active';
  IF v_station_count <> array_length(p_station_ids, 1) THEN
    RAISE EXCEPTION 'INVALID_STATIONS' USING MESSAGE = 'stations must belong to club and be active';
  END IF;

  -- Лочим конфликтующие записи и проверяем overlap
  PERFORM 1
  FROM public.booking_stations bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.station_id = ANY(p_station_ids)
    AND b.status IN ('pending','confirmed','checked_in')
    AND b.starts_at < p_ends_at
    AND b.ends_at   > p_starts_at
  FOR UPDATE;

  SELECT count(*) INTO v_overlap_count
  FROM public.booking_stations bs
  JOIN public.bookings b ON b.id = bs.booking_id
  WHERE bs.station_id = ANY(p_station_ids)
    AND b.status IN ('pending','confirmed','checked_in')
    AND b.starts_at < p_ends_at
    AND b.ends_at   > p_starts_at;

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'BOOKING_SLOT_OCCUPIED' USING MESSAGE = 'slot is taken';
  END IF;

  -- Считаем цену
  v_hours := EXTRACT(EPOCH FROM (p_ends_at - p_starts_at)) / 3600.0;
  FOR v_station_id IN SELECT unnest(p_station_ids) LOOP
    SELECT z.* INTO v_zone
    FROM public.stations s
    JOIN public.zones z ON z.id = s.zone_id
    WHERE s.id = v_station_id;

    v_price := (v_zone.price_per_hour * v_hours)::integer;
    v_total := v_total + v_price;
  END LOOP;

  -- Генерим booking_code: CB-XXXXXXXX (8 hex-симоволов из gen_random_uuid)
  -- gen_random_uuid() — в core PostgreSQL, не требует pgcrypto в search_path.
  LOOP
    v_code := 'CB-' || upper(substring(replace(gen_random_uuid()::text, '-', '') FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE booking_code = v_code);
  END LOOP;

  -- INSERT booking
  INSERT INTO public.bookings (
    booking_code, user_id, club_id, starts_at, ends_at, status, total_amount, is_group, notes
  ) VALUES (
    v_code, v_user, p_club_id, p_starts_at, p_ends_at, 'confirmed', v_total,
    array_length(p_station_ids, 1) > 1, p_notes
  ) RETURNING * INTO v_booking;

  -- INSERT booking_stations (вторым проходом считаем цену на каждый ПК)
  FOR v_station_id IN SELECT unnest(p_station_ids) LOOP
    SELECT z.price_per_hour INTO v_price
    FROM public.stations s JOIN public.zones z ON z.id = s.zone_id
    WHERE s.id = v_station_id;
    INSERT INTO public.booking_stations (booking_id, station_id, price_amount)
    VALUES (v_booking.id, v_station_id, (v_price * v_hours)::integer);
  END LOOP;

  -- Уведомления (постановка в очередь)
  INSERT INTO public.notifications_log (event_type, channel, recipient_id, payload)
  VALUES
    ('booking.created', 'email',    v_user,   jsonb_build_object('booking_id', v_booking.id)),
    ('booking.created', 'web_push', NULL,     jsonb_build_object('booking_id', v_booking.id, 'club_id', p_club_id));

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id, payload)
  VALUES (v_user, p_club_id, 'booking.create', 'booking', v_booking.id,
          jsonb_build_object('stations', p_station_ids, 'total', v_total));

  RETURN v_booking;
END; $$;

REVOKE ALL ON FUNCTION public.create_booking FROM public;
GRANT  EXECUTE ON FUNCTION public.create_booking TO authenticated;
