-- ============================================================================
-- CyberBook — фикс RLS infinite recursion.
--
-- Проблема: политики на club_members (и любые политики, ссылающиеся на
-- club_members через EXISTS) рекурсивно применяют сами себя при оценке.
-- Postgres падает с "infinite recursion detected in policy".
--
-- Решение: SECURITY DEFINER хелперы is_club_member() / is_club_owner(),
-- которые обходят RLS и кешируются в одном вызове. Все политики, которые
-- проверяли членство через подзапрос, переписаны на эти хелперы.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper functions (SECURITY DEFINER → обходят RLS, не триггерят рекурсию)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_club_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;
REVOKE ALL ON FUNCTION public.is_club_owner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_club_owner(uuid) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. club_members — переписать без recursion
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS club_members_select_own              ON public.club_members;
DROP POLICY IF EXISTS club_members_insert_owner_or_self_first ON public.club_members;
DROP POLICY IF EXISTS club_members_delete_owner            ON public.club_members;

CREATE POLICY club_members_select_own ON public.club_members
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_club_member(club_id)
  );

CREATE POLICY club_members_insert_owner ON public.club_members
  FOR INSERT WITH CHECK (
    public.is_club_owner(club_id)
  );

CREATE POLICY club_members_delete_owner ON public.club_members
  FOR DELETE USING (
    public.is_club_owner(club_id) AND role <> 'owner'
  );

-- ----------------------------------------------------------------------------
-- 3. clubs — owner update/delete через хелпер
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS clubs_update_owner ON public.clubs;
DROP POLICY IF EXISTS clubs_delete_owner ON public.clubs;

CREATE POLICY clubs_update_owner ON public.clubs
  FOR UPDATE USING (public.is_club_owner(id));

CREATE POLICY clubs_delete_owner ON public.clubs
  FOR DELETE USING (public.is_club_owner(id));

-- ----------------------------------------------------------------------------
-- 4. zones / stations / club_maps — admin-mutate через хелпер
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS zones_mutate_staff ON public.zones;
CREATE POLICY zones_mutate_staff ON public.zones
  FOR ALL
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

DROP POLICY IF EXISTS stations_mutate_staff ON public.stations;
CREATE POLICY stations_mutate_staff ON public.stations
  FOR ALL
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

DROP POLICY IF EXISTS club_maps_mutate_staff ON public.club_maps;
CREATE POLICY club_maps_mutate_staff ON public.club_maps
  FOR ALL
  USING (public.is_club_member(club_id))
  WITH CHECK (public.is_club_member(club_id));

-- ----------------------------------------------------------------------------
-- 5. bookings + booking_stations
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS bookings_select_owner_or_staff ON public.bookings;
CREATE POLICY bookings_select_owner_or_staff ON public.bookings
  FOR SELECT USING (
    user_id = auth.uid() OR public.is_club_member(club_id)
  );

DROP POLICY IF EXISTS bookings_update_user_cancel_or_staff ON public.bookings;
CREATE POLICY bookings_update_user_cancel_or_staff ON public.bookings
  FOR UPDATE
  USING (
    (user_id = auth.uid() AND status IN ('pending','confirmed'))
    OR public.is_club_member(club_id)
  )
  WITH CHECK (
    (user_id = auth.uid() AND status IN ('pending','confirmed','cancelled'))
    OR public.is_club_member(club_id)
  );

DROP POLICY IF EXISTS booking_stations_select ON public.booking_stations;
CREATE POLICY booking_stations_select ON public.booking_stations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_stations.booking_id
        AND (b.user_id = auth.uid() OR public.is_club_member(b.club_id))
    )
  );

-- ----------------------------------------------------------------------------
-- 6. audit_log
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_select_club_staff ON public.audit_log;
CREATE POLICY audit_select_club_staff ON public.audit_log
  FOR SELECT USING (
    club_id IS NOT NULL AND public.is_club_member(club_id)
  );

-- ----------------------------------------------------------------------------
-- 7. invitations
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS invitations_select_club_owner ON public.invitations;
CREATE POLICY invitations_select_club_owner ON public.invitations
  FOR SELECT USING (public.is_club_owner(club_id));

DROP POLICY IF EXISTS invitations_insert_club_owner ON public.invitations;
CREATE POLICY invitations_insert_club_owner ON public.invitations
  FOR INSERT WITH CHECK (public.is_club_owner(club_id));

-- ----------------------------------------------------------------------------
-- 8. users + user_reputation cross-table
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS users_select_self_or_club_staff ON public.users;
CREATE POLICY users_select_self_or_club_staff ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.user_id = users.id
        AND public.is_club_member(b.club_id)
    )
  );

DROP POLICY IF EXISTS reputation_select_club_staff ON public.user_reputation;
CREATE POLICY reputation_select_club_staff ON public.user_reputation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.user_id = user_reputation.user_id
        AND public.is_club_member(b.club_id)
    )
  );

COMMIT;
