-- ============================================================================
-- CyberBook MVP — ядро схемы.
-- Spec: SPEC.md (все 11 модулей MVP + сквозные сущности).
-- Содержит: таблицы, индексы, CHECK, RLS, триггеры, SECURITY DEFINER функции.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Расширения
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Общий trigger: автообновление updated_at
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

-- ============================================================================
-- USERS (публичный профиль, PK = auth.users.id)
-- ============================================================================
CREATE TABLE public.users (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text NOT NULL,
  phone      text UNIQUE,
  full_name  text,
  birthdate  date,
  role       text NOT NULL DEFAULT 'player'
             CHECK (role IN ('player','club_admin','super_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- INSERT напрямую запрещён — строка создаётся триггером on_auth_user_created.
-- SELECT-политика с cross-table refs (bookings + club_members) — в конце файла.

-- ============================================================================
-- USER REPUTATION
-- ============================================================================
CREATE TABLE public.user_reputation (
  user_id         uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 100,
  total_bookings  integer NOT NULL DEFAULT 0,
  no_shows        integer NOT NULL DEFAULT 0,
  cancellations   integer NOT NULL DEFAULT 0,
  banned_until    timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER reputation_updated_at BEFORE UPDATE ON public.user_reputation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_reputation ENABLE ROW LEVEL SECURITY;

CREATE POLICY reputation_select_self ON public.user_reputation
  FOR SELECT USING (user_id = auth.uid());

-- SELECT-политика club_staff с cross-table refs — в конце файла.
-- Пишет только SECURITY DEFINER функция apply_reputation_event, никаких direct UPDATE.

-- ============================================================================
-- CLUBS (публично читается, мутирует только owner)
-- ============================================================================
CREATE TABLE public.clubs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,50}$'),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  city          text NOT NULL,
  address       text NOT NULL,
  timezone      text NOT NULL DEFAULT 'Asia/Almaty',
  open_time     time NOT NULL,
  close_time    time NOT NULL,
  contact_phone text NOT NULL,
  instagram     text,
  logo_url      text,
  cover_url     text,
  description   text,
  status        text NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','paused','archived')),
  subscription_plan text NOT NULL DEFAULT 'free'
                CHECK (subscription_plan IN ('free','start','pro','network')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clubs_status ON public.clubs(status);
CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY clubs_select_public ON public.clubs
  FOR SELECT USING (true);  -- витрина публичная

CREATE POLICY clubs_insert_authenticated ON public.clubs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE/DELETE-политики с ссылкой на club_members — в конце файла.

-- ============================================================================
-- CLUB MEMBERS (owner/admin)
-- ============================================================================
CREATE TABLE public.club_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, user_id)
);
CREATE INDEX idx_club_members_user ON public.club_members(user_id);

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY club_members_select_own ON public.club_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members self
      WHERE self.club_id = club_members.club_id AND self.user_id = auth.uid()
    )
  );

CREATE POLICY club_members_insert_owner_or_self_first ON public.club_members
  FOR INSERT WITH CHECK (
    -- Первый owner создаётся через функцию create_club_with_owner (SECURITY DEFINER).
    -- Прямой INSERT из клиента — только если ты уже owner этого клуба.
    EXISTS (
      SELECT 1 FROM public.club_members owner
      WHERE owner.club_id = club_members.club_id
        AND owner.user_id = auth.uid()
        AND owner.role = 'owner'
    )
  );

CREATE POLICY club_members_delete_owner ON public.club_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.club_members owner
      WHERE owner.club_id = club_members.club_id
        AND owner.user_id = auth.uid()
        AND owner.role = 'owner'
    )
    AND club_members.role <> 'owner'  -- нельзя удалить owner
  );

-- ============================================================================
-- ZONES
-- ============================================================================
CREATE TABLE public.zones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
  color          text NOT NULL DEFAULT '#8B5CF6'
                 CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  price_per_hour integer NOT NULL CHECK (price_per_hour > 0),
  description    text,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zones_club ON public.zones(club_id, sort_order);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY zones_select_public ON public.zones FOR SELECT USING (true);

CREATE POLICY zones_mutate_staff ON public.zones
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = zones.club_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = zones.club_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STATIONS (ПК на карте)
-- ============================================================================
CREATE TABLE public.stations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  zone_id    uuid NOT NULL REFERENCES public.zones(id) ON DELETE RESTRICT,
  name       text NOT NULL,
  position_x integer NOT NULL CHECK (position_x >= 0 AND position_x < 40),
  position_y integer NOT NULL CHECK (position_y >= 0 AND position_y < 40),
  specs      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status     text NOT NULL DEFAULT 'active'
             CHECK (status IN ('active','maintenance','retired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, name)
);
CREATE INDEX idx_stations_club_zone ON public.stations(club_id, zone_id);
CREATE INDEX idx_stations_club_status ON public.stations(club_id, status);

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY stations_select_public ON public.stations FOR SELECT USING (true);

CREATE POLICY stations_mutate_staff ON public.stations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = stations.club_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = stations.club_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- CLUB MAPS (layout зала)
-- ============================================================================
CREATE TABLE public.club_maps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL UNIQUE REFERENCES public.clubs(id) ON DELETE CASCADE,
  layout     jsonb NOT NULL DEFAULT '{"gridW":20,"gridH":15,"cellSize":32,"walls":[],"labels":[],"decorations":[]}'::jsonb,
  version    integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER club_maps_updated_at BEFORE UPDATE ON public.club_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.club_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY club_maps_select_public ON public.club_maps FOR SELECT USING (true);

CREATE POLICY club_maps_mutate_staff ON public.club_maps
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_maps.club_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_maps.club_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOOKINGS
-- ============================================================================
CREATE TABLE public.bookings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code   text UNIQUE NOT NULL,
  user_id        uuid NOT NULL REFERENCES public.users(id),
  club_id        uuid NOT NULL REFERENCES public.clubs(id),
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'confirmed'
                 CHECK (status IN ('pending','confirmed','checked_in','completed','cancelled','no_show')),
  total_amount   integer NOT NULL CHECK (total_amount >= 0),
  is_group       boolean NOT NULL DEFAULT false,
  notes          text,
  cancel_reason  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  checked_in_at  timestamptz,
  completed_at   timestamptz,
  cancelled_at   timestamptz,
  CHECK (ends_at > starts_at),
  CHECK (ends_at - starts_at >= interval '1 hour'),
  CHECK (ends_at - starts_at <= interval '12 hours')
);
CREATE INDEX idx_bookings_club_time ON public.bookings(club_id, starts_at);
CREATE INDEX idx_bookings_user ON public.bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_active_slot ON public.bookings(club_id, starts_at, ends_at)
  WHERE status IN ('pending','confirmed','checked_in');
CREATE INDEX idx_bookings_today_board ON public.bookings(club_id, starts_at, status)
  WHERE status IN ('confirmed','checked_in');

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_select_owner_or_staff ON public.bookings
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = bookings.club_id AND cm.user_id = auth.uid()
    )
  );

-- INSERT: только через create_booking() (SECURITY DEFINER) — чтобы гарантировать FOR UPDATE + overlap-проверку.
-- Прямой INSERT блокируем: нет политики INSERT с USING.

CREATE POLICY bookings_update_user_cancel_or_staff ON public.bookings
  FOR UPDATE USING (
    (user_id = auth.uid() AND status IN ('pending','confirmed'))
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = bookings.club_id AND cm.user_id = auth.uid()
    )
  ) WITH CHECK (
    (user_id = auth.uid() AND status IN ('pending','confirmed','cancelled'))
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = bookings.club_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOOKING STATIONS (линки бронь ↔ ПК)
-- ============================================================================
CREATE TABLE public.booking_stations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  station_id   uuid NOT NULL REFERENCES public.stations(id),
  price_amount integer NOT NULL CHECK (price_amount >= 0),
  UNIQUE (booking_id, station_id)
);
CREATE INDEX idx_booking_stations_station ON public.booking_stations(station_id);

ALTER TABLE public.booking_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_stations_select ON public.booking_stations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_stations.booking_id
        AND (b.user_id = auth.uid()
             OR EXISTS (
               SELECT 1 FROM public.club_members cm
               WHERE cm.club_id = b.club_id AND cm.user_id = auth.uid()
             ))
    )
  );

-- ============================================================================
-- NOTIFICATIONS LOG
-- ============================================================================
CREATE TABLE public.notifications_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  channel      text NOT NULL CHECK (channel IN ('email','web_push','telegram','sms')),
  recipient_id uuid,
  payload      jsonb NOT NULL,
  status       text NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','sent','failed')),
  error        text,
  retry_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
);
CREATE INDEX idx_notifications_queued
  ON public.notifications_log(status, created_at)
  WHERE status = 'queued';

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;
-- По умолчанию — закрыто для клиентов. Только сервис-роль пишет и читает.

-- ============================================================================
-- AUDIT LOG
-- ============================================================================
CREATE TABLE public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  club_id     uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  payload     jsonb,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_club  ON public.audit_log(club_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
-- Read — только club_members; write — только service-role.
CREATE POLICY audit_select_club_staff ON public.audit_log
  FOR SELECT USING (
    club_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = audit_log.club_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- INVITATIONS
-- ============================================================================
CREATE TABLE public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin')),
  token       text UNIQUE NOT NULL,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by  uuid NOT NULL REFERENCES public.users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON public.invitations(token) WHERE accepted_at IS NULL;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_select_club_owner ON public.invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = invitations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

CREATE POLICY invitations_insert_club_owner ON public.invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = invitations.club_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- ============================================================================
-- CROSS-TABLE POLICIES
-- Политики, ссылающиеся на несколько таблиц, создаются в конце — все таблицы
-- уже существуют, Postgres успешно валидирует CREATE POLICY.
-- ============================================================================

-- users: admin клуба видит профили гостей, у которых есть брони в его клубе
CREATE POLICY users_select_self_or_club_staff ON public.users
  FOR SELECT USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.club_members cm ON cm.club_id = b.club_id
      WHERE b.user_id = public.users.id AND cm.user_id = auth.uid()
    )
  );

-- user_reputation: admin клуба видит рейтинг гостей, у которых есть брони
CREATE POLICY reputation_select_club_staff ON public.user_reputation
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.bookings b
      JOIN public.club_members cm ON cm.club_id = b.club_id
      WHERE b.user_id = public.user_reputation.user_id
        AND cm.user_id = auth.uid()
    )
  );

-- clubs: только owner может менять или удалять клуб
CREATE POLICY clubs_update_owner ON public.clubs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );

CREATE POLICY clubs_delete_owner ON public.clubs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );

COMMIT;
