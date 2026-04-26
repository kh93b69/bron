-- ============================================================================
-- CyberBook — SECURITY DEFINER функции.
-- Публичные объекты: create_booking, cancel_booking, create_club_with_owner,
-- apply_reputation_event, handle_new_auth_user.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Триггер: при регистрации в auth.users создать public.users + user_reputation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_reputation (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- apply_reputation_event — единственный путь изменения user_reputation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_reputation_event(p_user uuid, p_event text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  CASE p_event
    WHEN 'completed' THEN
      UPDATE public.user_reputation
      SET score = LEAST(score + 5, 100),
          total_bookings = total_bookings + 1
      WHERE user_id = p_user;

    WHEN 'cancel_late' THEN
      UPDATE public.user_reputation
      SET score = score - 15,
          cancellations = cancellations + 1
      WHERE user_id = p_user;

    WHEN 'no_show' THEN
      UPDATE public.user_reputation
      SET score = score - 30,
          no_shows = no_shows + 1,
          banned_until = CASE
            WHEN no_shows + 1 >= 2 THEN now() + interval '7 days'
            ELSE banned_until
          END
      WHERE user_id = p_user;

    ELSE
      RAISE EXCEPTION 'Unknown reputation event: %', p_event;
  END CASE;
END; $$;

REVOKE ALL ON FUNCTION public.apply_reputation_event FROM public;
GRANT  EXECUTE ON FUNCTION public.apply_reputation_event TO service_role;

-- ----------------------------------------------------------------------------
-- create_club_with_owner — создаёт клуб и добавляет текущего user как owner.
-- Используется во время onboarding'а.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_club_with_owner(
  p_name          text,
  p_slug          text,
  p_city          text,
  p_address       text,
  p_contact_phone text,
  p_timezone      text DEFAULT 'Asia/Almaty',
  p_open_time     time DEFAULT '12:00',
  p_close_time    time DEFAULT '04:00'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_club uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.clubs (name, slug, city, address, contact_phone, timezone, open_time, close_time)
  VALUES (p_name, p_slug, p_city, p_address, p_contact_phone, p_timezone, p_open_time, p_close_time)
  RETURNING id INTO v_club;

  INSERT INTO public.club_members (club_id, user_id, role) VALUES (v_club, v_user, 'owner');

  INSERT INTO public.club_maps (club_id) VALUES (v_club);

  UPDATE public.users SET role = 'club_admin' WHERE id = v_user AND role = 'player';

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id)
  VALUES (v_user, v_club, 'club.created', 'club', v_club);

  RETURN v_club;
END; $$;

REVOKE ALL ON FUNCTION public.create_club_with_owner FROM public;
GRANT  EXECUTE ON FUNCTION public.create_club_with_owner TO authenticated;

-- ----------------------------------------------------------------------------
-- create_booking — атомарное создание брони c проверкой overlap.
-- ----------------------------------------------------------------------------
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

  -- Генерим booking_code: CB-XXXXXXXX (8 hex-символов из gen_random_uuid).
  -- gen_random_uuid() — в core PostgreSQL, не требует pgcrypto в search_path
  -- (в Supabase pgcrypto установлен в schema "extensions", а у функции
  --  search_path = public — gen_random_bytes() оттуда недоступен).
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

-- ----------------------------------------------------------------------------
-- cancel_booking — отмена с учётом правила «не позже чем за 2 часа» для user'а.
-- Админ клуба может отменить в любое время.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_reason     text DEFAULT NULL
) RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_book   public.bookings;
  v_is_staff boolean;
  v_late   boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_book FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = v_book.club_id AND cm.user_id = v_user
  ) INTO v_is_staff;

  IF v_book.user_id <> v_user AND NOT v_is_staff THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_book.status NOT IN ('pending','confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATE' USING MESSAGE = v_book.status;
  END IF;

  v_late := (v_book.starts_at - now()) < interval '2 hours';

  IF v_book.user_id = v_user AND NOT v_is_staff AND v_late THEN
    RAISE EXCEPTION 'CANCEL_TOO_LATE';
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled',
      cancel_reason = p_reason,
      cancelled_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_book;

  IF v_book.user_id = v_user AND v_late THEN
    PERFORM public.apply_reputation_event(v_user, 'cancel_late');
  END IF;

  INSERT INTO public.notifications_log (event_type, channel, recipient_id, payload)
  VALUES ('booking.cancelled', 'web_push', NULL,
          jsonb_build_object('booking_id', v_book.id, 'club_id', v_book.club_id));

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id)
  VALUES (v_user, v_book.club_id, 'booking.cancel', 'booking', v_book.id);

  RETURN v_book;
END; $$;

REVOKE ALL ON FUNCTION public.cancel_booking FROM public;
GRANT  EXECUTE ON FUNCTION public.cancel_booking TO authenticated;

-- ----------------------------------------------------------------------------
-- check_in_booking — админ клуба отмечает «пришёл».
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_book   public.bookings;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_book FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = v_book.club_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_book.status = 'checked_in' THEN
    RETURN v_book;  -- идемпотентно
  END IF;

  IF v_book.status <> 'confirmed' THEN
    RAISE EXCEPTION 'INVALID_STATE' USING MESSAGE = v_book.status;
  END IF;

  UPDATE public.bookings
  SET status = 'checked_in', checked_in_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_book;

  INSERT INTO public.notifications_log (event_type, channel, recipient_id, payload)
  VALUES ('booking.checked_in', 'web_push', v_book.user_id,
          jsonb_build_object('booking_id', v_book.id));

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id)
  VALUES (v_user, v_book.club_id, 'booking.check_in', 'booking', v_book.id);

  RETURN v_book;
END; $$;

REVOKE ALL ON FUNCTION public.check_in_booking FROM public;
GRANT  EXECUTE ON FUNCTION public.check_in_booking TO authenticated;

-- ----------------------------------------------------------------------------
-- mark_no_show — админ помечает «не пришёл». Обычно автоматом через cron.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_no_show(p_booking_id uuid)
RETURNS public.bookings LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_book public.bookings;
BEGIN
  SELECT * INTO v_book FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_user IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.club_members cm
    WHERE cm.club_id = v_book.club_id AND cm.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_book.status <> 'confirmed' THEN
    RAISE EXCEPTION 'INVALID_STATE' USING MESSAGE = v_book.status;
  END IF;

  UPDATE public.bookings
  SET status = 'no_show'
  WHERE id = p_booking_id
  RETURNING * INTO v_book;

  PERFORM public.apply_reputation_event(v_book.user_id, 'no_show');

  INSERT INTO public.notifications_log (event_type, channel, recipient_id, payload)
  VALUES ('booking.no_show', 'email', v_book.user_id,
          jsonb_build_object('booking_id', v_book.id));

  INSERT INTO public.audit_log (actor_id, club_id, action, entity_type, entity_id)
  VALUES (v_user, v_book.club_id, 'booking.no_show', 'booking', v_book.id);

  RETURN v_book;
END; $$;

REVOKE ALL ON FUNCTION public.mark_no_show FROM public;
GRANT  EXECUTE ON FUNCTION public.mark_no_show TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- run_auto_status_transitions — cron: auto-no-show + auto-complete.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_auto_status_transitions()
RETURNS TABLE (noshow integer, completed integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
  v_noshow integer := 0;
  v_completed integer := 0;
BEGIN
  FOR v_row IN
    SELECT id, user_id FROM public.bookings
    WHERE status = 'confirmed'
      AND starts_at + interval '30 minutes' < now()
      AND checked_in_at IS NULL
    LIMIT 500
  LOOP
    PERFORM public.mark_no_show(v_row.id);
    v_noshow := v_noshow + 1;
  END LOOP;

  UPDATE public.bookings
  SET status = 'completed', completed_at = now()
  WHERE status = 'checked_in' AND ends_at < now();
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  INSERT INTO public.audit_log (action, entity_type, payload)
  VALUES ('cron.auto_transitions', 'system',
          jsonb_build_object('noshow', v_noshow, 'completed', v_completed));

  RETURN QUERY SELECT v_noshow, v_completed;
END; $$;

REVOKE ALL ON FUNCTION public.run_auto_status_transitions FROM public;
GRANT  EXECUTE ON FUNCTION public.run_auto_status_transitions TO service_role;

-- ----------------------------------------------------------------------------
-- availability_for_slot — публичная функция для витрины.
-- Возвращает для клуба на интервал [from, to) мапу station_id → статус.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.availability_for_slot(
  p_club_id uuid,
  p_from    timestamptz,
  p_to      timestamptz
) RETURNS TABLE (station_id uuid, status text) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT s.id,
    CASE
      WHEN s.status = 'maintenance' THEN 'maintenance'
      WHEN EXISTS (
        SELECT 1
        FROM public.booking_stations bs
        JOIN public.bookings b ON b.id = bs.booking_id
        WHERE bs.station_id = s.id
          AND b.status IN ('pending','confirmed','checked_in')
          AND b.starts_at < p_to
          AND b.ends_at   > p_from
      ) THEN 'booked'
      ELSE 'available'
    END AS status
  FROM public.stations s
  WHERE s.club_id = p_club_id
    AND s.status IN ('active','maintenance');
END; $$;

GRANT EXECUTE ON FUNCTION public.availability_for_slot TO anon, authenticated;

COMMIT;
