# SPEC — CyberBook

> Техническая спецификация. Каждый модуль описан так, чтобы субагент Claude Code реализовал его без уточнений.
>
> **Стек (зафиксирован):** Railway + GitHub + Supabase · Next.js 15 App Router + TS + Tailwind v4 + shadcn/ui + React Query + RHF + Zod · Supabase Auth с **Email OTP** · Supabase Realtime для live-списков. Платежи и SMS в MVP отсутствуют (см. приоритезацию в конце документа).
>
> Типы полей — SQL-стандарт (`uuid`, `text`, `jsonb`, `timestamptz`, `integer`, `boolean`). RLS-политики используют `auth.uid()` из Supabase Auth.

---

## Модули MVP

1. [Аутентификация и роли](#1-аутентификация-и-роли)
2. [Клубы и членство](#2-клубы-и-членство)
3. [Зоны и тарифы](#3-зоны-и-тарифы)
4. [Станции и карта зала](#4-станции-и-карта-зала)
5. [Редактор карты](#5-редактор-карты)
6. [Публичная витрина клуба](#6-публичная-витрина-клуба)
7. [Бронирование](#7-бронирование)
8. [Групповое бронирование](#8-групповое-бронирование)
9. [Уведомления](#9-уведомления)
10. [Рейтинг и репутация клиентов](#10-рейтинг-и-репутация-клиентов)
11. [Админ-панель клуба](#11-админ-панель-клуба)

## Модули v2

12. [Чёрный список](#12-чёрный-список)
13. [«Горящие места»](#13-горящие-места)
14. [Платежи: депозиты](#14-платежи-депозиты)
15. [Подписки B2B](#15-подписки-b2b)
16. [Аналитика](#16-аналитика)
17. [Super-admin](#17-super-admin)

---

## Сквозные сущности

### Таблицы (каноничная схема)

```
users                                   -- PK совпадает с auth.users.id (Supabase)
  id              uuid PK REFERENCES auth.users(id) ON DELETE CASCADE
  email           text NOT NULL                       -- дублируется из auth.users для удобных join'ов
  phone           text UNIQUE                         -- опционально в MVP, обязательно в v2 (SMS)
  full_name       text
  birthdate       date
  role            text NOT NULL DEFAULT 'player'      -- player | club_admin | super_admin
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()

clubs
  id              uuid PK
  slug            text UNIQUE NOT NULL        -- для URL: /c/colizeum-almaty
  name            text NOT NULL
  city            text NOT NULL
  address         text NOT NULL
  timezone        text NOT NULL DEFAULT 'Asia/Almaty'
  open_time       time NOT NULL               -- 12:00
  close_time      time NOT NULL               -- 04:00
  contact_phone   text NOT NULL
  instagram       text
  logo_url        text
  cover_url       text
  description     text
  status          text NOT NULL DEFAULT 'active'  -- active | paused | archived
  subscription_plan text NOT NULL DEFAULT 'free'  -- free | start | pro | network
  created_at      timestamptz NOT NULL DEFAULT now()

club_members
  id              uuid PK
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  role            text NOT NULL               -- owner | admin
  created_at      timestamptz NOT NULL DEFAULT now()
  UNIQUE(club_id, user_id)

zones
  id              uuid PK
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
  name            text NOT NULL               -- 'VIP', 'Bootcamp', 'General'
  color           text NOT NULL DEFAULT '#8B5CF6'
  price_per_hour  integer NOT NULL            -- в тенге (₸), hardcoded integer, без float
  description     text
  sort_order      integer NOT NULL DEFAULT 0
  created_at      timestamptz NOT NULL DEFAULT now()

stations
  id              uuid PK
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
  zone_id         uuid NOT NULL REFERENCES zones(id) ON DELETE RESTRICT
  name            text NOT NULL               -- 'PC-12', 'VIP-3'
  position_x      integer NOT NULL            -- координата на карте (grid units)
  position_y      integer NOT NULL
  specs           jsonb                       -- {cpu, gpu, ram, monitor_hz, peripherals}
  status          text NOT NULL DEFAULT 'active'  -- active | maintenance | retired
  created_at      timestamptz NOT NULL DEFAULT now()
  UNIQUE(club_id, name)

club_maps
  id              uuid PK
  club_id         uuid NOT NULL UNIQUE REFERENCES clubs(id) ON DELETE CASCADE
  layout          jsonb NOT NULL              -- {gridW, gridH, walls: [...], labels: [...]}
  version         integer NOT NULL DEFAULT 1
  updated_at      timestamptz NOT NULL DEFAULT now()

bookings
  id              uuid PK
  booking_code    text UNIQUE NOT NULL        -- 'CB-8F3K2X', для QR
  user_id         uuid NOT NULL REFERENCES users(id)
  club_id         uuid NOT NULL REFERENCES clubs(id)
  starts_at       timestamptz NOT NULL
  ends_at         timestamptz NOT NULL
  status          text NOT NULL DEFAULT 'pending' -- pending | confirmed | checked_in | completed | cancelled | no_show
  total_amount    integer NOT NULL            -- в тенге
  is_group        boolean NOT NULL DEFAULT false
  notes           text
  cancel_reason   text
  created_at      timestamptz NOT NULL DEFAULT now()
  checked_in_at   timestamptz
  completed_at    timestamptz
  cancelled_at    timestamptz
  CHECK (ends_at > starts_at)

booking_stations
  id              uuid PK
  booking_id      uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE
  station_id      uuid NOT NULL REFERENCES stations(id)
  price_amount    integer NOT NULL            -- цена этого ПК за период брони
  UNIQUE(booking_id, station_id)

user_reputation
  user_id         uuid PK REFERENCES users(id) ON DELETE CASCADE
  score           integer NOT NULL DEFAULT 100
  total_bookings  integer NOT NULL DEFAULT 0
  no_shows        integer NOT NULL DEFAULT 0
  cancellations   integer NOT NULL DEFAULT 0
  banned_until    timestamptz
  updated_at      timestamptz NOT NULL DEFAULT now()

notifications_log
  id              uuid PK
  event_type      text NOT NULL               -- booking_created | booking_reminder | booking_cancelled | admin_new_booking
  channel         text NOT NULL               -- sms | web_push | telegram | email
  recipient_id    uuid                        -- user_id или club_member.id
  payload         jsonb NOT NULL
  status          text NOT NULL DEFAULT 'queued'  -- queued | sent | failed
  error           text
  created_at      timestamptz NOT NULL DEFAULT now()
  sent_at         timestamptz

-- OTP-коды НЕ храним своей таблицей: в MVP используется Supabase Auth
-- (signInWithOtp по email) — Supabase сам управляет rate-limit и expiration.
-- В v2 при добавлении SMS-OTP: таблица otp_codes (phone, code_hash, attempts, expires_at).

-- v2
blacklists
  id              uuid PK
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
  user_id         uuid NOT NULL REFERENCES users(id)
  reason          text
  banned_by       uuid NOT NULL REFERENCES users(id)
  expires_at      timestamptz                 -- NULL = permanent
  created_at      timestamptz NOT NULL DEFAULT now()
  UNIQUE(club_id, user_id)

promotions
  id              uuid PK
  club_id         uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE
  name            text NOT NULL
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 99)
  applies_to      text NOT NULL DEFAULT 'all' -- all | zone | station
  zone_id         uuid REFERENCES zones(id)
  time_from       time NOT NULL               -- 10:00
  time_to         time NOT NULL               -- 16:00
  weekdays        smallint[] NOT NULL         -- {1,2,3,4,5} (ISO, Пн=1)
  active          boolean NOT NULL DEFAULT true
  created_at      timestamptz NOT NULL DEFAULT now()

payment_intents
  id              uuid PK
  booking_id      uuid REFERENCES bookings(id)
  user_id         uuid NOT NULL REFERENCES users(id)
  amount          integer NOT NULL            -- в тийинах (₸ * 100)
  currency        text NOT NULL DEFAULT 'KZT'
  provider        text NOT NULL               -- kaspi | freedom | stripe
  provider_ref    text                        -- id в провайдере
  status          text NOT NULL DEFAULT 'pending'  -- pending | paid | refunded | failed | expired
  type            text NOT NULL               -- deposit | subscription
  created_at      timestamptz NOT NULL DEFAULT now()
  paid_at         timestamptz
  refunded_at     timestamptz

subscriptions
  id              uuid PK
  club_id         uuid NOT NULL UNIQUE REFERENCES clubs(id)
  plan            text NOT NULL               -- start | pro | network
  billing_period  text NOT NULL DEFAULT 'monthly'  -- monthly | yearly
  status          text NOT NULL               -- trialing | active | past_due | cancelled
  current_period_start timestamptz NOT NULL
  current_period_end   timestamptz NOT NULL
  cancel_at_period_end boolean NOT NULL DEFAULT false
  created_at      timestamptz NOT NULL DEFAULT now()

audit_log
  id              uuid PK
  actor_id        uuid REFERENCES users(id)
  club_id         uuid REFERENCES clubs(id)
  action          text NOT NULL               -- booking.cancel, blacklist.add, map.update
  entity_type     text NOT NULL
  entity_id       uuid
  payload         jsonb
  ip              inet
  user_agent      text
  created_at      timestamptz NOT NULL DEFAULT now()
```

### Индексы (обязательные)
```
CREATE INDEX idx_bookings_station_time ON booking_stations(station_id);
CREATE INDEX idx_bookings_club_time    ON bookings(club_id, starts_at);
CREATE INDEX idx_bookings_user         ON bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_active_slot  ON bookings(club_id, starts_at, ends_at) WHERE status IN ('pending','confirmed','checked_in');
CREATE INDEX idx_stations_club_zone    ON stations(club_id, zone_id);
CREATE INDEX idx_notifications_queued  ON notifications_log(status, created_at) WHERE status = 'queued';
```

### Глобальные RLS-политики
- `users`: SELECT — `auth.uid() = id` ИЛИ user состоит в клубе как admin/owner (для имён клиентов в админке). UPDATE — только `auth.uid() = id`. INSERT — через триггер `on_auth_user_created` (создаётся строка при регистрации в `auth.users`).
- `clubs`: SELECT — всем (публичная витрина). UPDATE/DELETE — только членам клуба с ролью `owner`.
- `club_members`: SELECT — только самим участникам клуба. INSERT/DELETE — только `owner`.
- `zones`, `stations`, `club_maps`: SELECT — всем (публично). INSERT/UPDATE/DELETE — только `club_members.role IN ('owner','admin')`.
- `bookings`: SELECT — владельцу брони (`user_id = auth.uid()`) ИЛИ `club_members` клуба. INSERT — аутентифицированный user для себя. UPDATE — user (только для cancel своей брони) или `club_members`.
- `user_reputation`: SELECT — владельцу ИЛИ `club_members` клуба, где user имеет бронь. Пишет только серверная логика (SECURITY DEFINER).

---

## 1. Аутентификация и роли

> MVP-реализация — через **Supabase Auth Email OTP**. Свой rate-limit/ OTP-хранилище писать не нужно: Supabase уже делает. Клиент вызывает `supabase.auth.signInWithOtp({ email })`, получает письмо с 6-значным кодом, передаёт в `supabase.auth.verifyOtp`. Магик-линки — включены, но бронирование и админка рассчитаны на ввод кода (лучше на мобильных).

### User Stories
- Как геймер, я хочу ввести email и получить код в письме, чтобы забронировать ПК без пароля.
- Как владелец клуба, я хочу зарегистрироваться по email и сразу пройти onboarding клуба.
- Как админ клуба, я хочу получить приглашение от владельца и войти под своей ролью.
- Как пользователь, я хочу, чтобы сессия сохранялась между вкладками и вкладками PWA.
- Как система, я должна автоматически создавать строку `users` и `user_reputation` при первой регистрации.

### Модель данных
— `users` (PK совпадает с `auth.users.id`). Сессии и креденшалы управляются Supabase Auth.
— Триггер `on_auth_user_created` копирует `id, email` в `users` и создаёт `user_reputation(score=100)`.

### API / клиентский flow
```
Клиент (supabase-js):
  supabase.auth.signInWithOtp({ email, options:{ shouldCreateUser:true } })
    → 200 (письмо ушло) | 429 (Supabase-rate-limit) | 400 (invalid email)
  supabase.auth.verifyOtp({ email, token:"428193", type:"email" })
    → 200 { session, user } | 401 (wrong/expired code)
  supabase.auth.signOut()
    → 204

Route handlers (для server-side страниц):
  GET  /api/auth/me                 → 200 { user, role, clubs:[...] } | 401
  POST /api/clubs/:id/invitations   body:{ email, role:'admin' }   → 201 { invite_token, expires_at } | 403
  POST /api/auth/invite/accept      body:{ invite_token }           → 200 { club, role } | 400 | 410
```

### Экраны
- **/login** — один экран: поле email → «Отправить код» → 6-ячеечный ввод → редирект. Состояния: idle, sending, code_sent, verifying, error.
- **/onboarding/club** — 3 шага (базовая инфо, часы работы, лого/обложка) для свежезарегистрированного владельца без клуба.
- **/invite/:token** — кнопка «Принять приглашение» (при наличии сессии) или email-login с возвратом на тот же URL.

### Бизнес-логика
- Supabase Auth сам управляет TTL кода (10 мин) и rate-limit (дефолт).
- Триггер `on_auth_user_created` (SQL): `INSERT INTO public.users(id, email)`, `INSERT INTO user_reputation(user_id, score)`.
- Приглашение админа — строка в `invitations` (токен, `club_id`, `role`, `expires_at=now()+7d`, `accepted_at`). Одноразовый.
- При логине user, у которого есть `club_members.role='owner'` → `/admin`. При отсутствии клуба → `/onboarding/club`.
- `role='super_admin'` проставляется только вручную через SQL (нет публичного эндпоинта).

### Крайние случаи
- Email не доставлен (Supabase статус `failed`) → кнопка «Отправить повторно» активна через 60 сек.
- Пользователь нажал ссылку из email на другом устройстве → сессия установится там, где нажал (поведение магик-линк Supabase по умолчанию).
- Истёкший invite-токен → 410 + CTA «попросить новое приглашение».
- Двойной аккаунт (регистрация по разным email) → merge вручную в super-admin (v2).

---

## 2. Клубы и членство

### User Stories
- Как владелец клуба, я хочу создать профиль клуба с названием, адресом и графиком работы.
- Как владелец, я хочу пригласить 1–3 админов на рецепцию.
- Как гость, я хочу открыть ссылку `/c/colizeum-almaty` и увидеть публичную витрину.

### Модель данных
— `clubs`, `club_members` (выше).

### API
```
POST   /api/clubs                     body: { name, city, address, phone, timezone, open_time, close_time }
   → 201 { club } | 401
GET    /api/clubs/:slug               → 200 { club, zones_count, stations_count } (публично)
PATCH  /api/clubs/:id                 body: partial { name, address, logo_url, ... }
   → 200 | 403
POST   /api/clubs/:id/invitations     body: { email, role: 'admin' }
   → 201 { invite_token, expires_at } | 403
DELETE /api/clubs/:id/members/:userId → 204 | 403
```

### Экраны
- **/onboarding/club** — мастер из 3 шагов: базовая инфо → часы работы → загрузка лого/обложки.
- **/admin/club** — настройки клуба (редактирование полей, управление админами, smart-ссылка для bio).
- **/c/:slug** — публичный профиль (шапка, описание, кнопка «Забронировать», карта зала снизу).

### Бизнес-логика
- `slug` генерируется из `name` + `city` (транслит), проверяется уникальность, редактируется вручную.
- Один user может быть `owner` только в одном клубе (на MVP); в нескольких — как `admin`.
- При удалении клуба (soft): `status='archived'`, все брони после текущего момента → `cancelled` с reason `club_archived`.

### Крайние случаи
- Часы работы через полночь (open 12:00, close 04:00) — логика «close_time < open_time означает следующий день».
- Таймзона клуба отличается от таймзоны сервера — всё хранится в UTC, отображается в TZ клуба.
- Попытка создать второй клуб тем же owner-аккаунтом на free-тарифе → 403 с подсказкой апгрейднуться на Network.

---

## 3. Зоны и тарифы

### User Stories
- Как владелец, я хочу разбить зал на VIP / Bootcamp / General с разными ценами.
- Как владелец, я хочу назначить цвет зоне, чтобы клиенты быстро их различали на карте.
- Как клиент, я хочу видеть цену зоны до выбора ПК.

### Модель данных — `zones`.

### API
```
POST   /api/clubs/:clubId/zones       body: { name, color, price_per_hour, description }
   → 201 { zone } | 403
GET    /api/clubs/:clubId/zones       → 200 { zones: [] } (публично)
PATCH  /api/zones/:id                 body: partial
   → 200 | 403
DELETE /api/zones/:id                 → 204 | 409 (если есть stations) | 403
```

### Экраны
- **/admin/zones** — список с CRUD, color picker, drag-reorder.

### Бизнес-логика
- Нельзя удалить зону, к которой привязаны stations — только если предварительно перенесены.
- При изменении `price_per_hour` — не затрагивает уже созданные брони.
- Валидация: `price_per_hour > 0`, `name` 1–30 символов, цвет в формате `#RRGGBB`.

### Крайние случаи
- Две зоны с одинаковым именем → allowed (например, несколько VIP-комнат), но warning в UI.
- Цена очень высокая (> 100 000 ₸) → подтверждение в UI, чтобы избежать ошибки ввода.

---

## 4. Станции и карта зала

### User Stories
- Как владелец, я хочу разместить 40 ПК на сетке, указать их имена и характеристики.
- Как клиент, я хочу видеть спецификации ПК при клике (CPU, GPU, монитор).
- Как админ, я хочу временно пометить ПК как «на обслуживании», чтобы его нельзя было забронировать.

### Модель данных — `stations`, `club_maps`.

### API
```
POST   /api/clubs/:clubId/stations    body: { zone_id, name, position_x, position_y, specs }
   → 201 | 403
GET    /api/clubs/:clubId/stations    → 200 { stations: [...] } (публично, с текущим availability для запрошенного slot)
GET    /api/clubs/:clubId/stations/availability?from=...&to=...
   → 200 { [station_id]: 'available'|'booked'|'maintenance' }
PATCH  /api/stations/:id              body: partial
   → 200 | 403
DELETE /api/stations/:id              → 204 | 403 (только если нет будущих броней, иначе soft archive)

PUT    /api/clubs/:clubId/map         body: { layout: {...} }
   → 200 | 403
GET    /api/clubs/:clubId/map         → 200 { layout, version } (публично)
```

### Экраны
- **/admin/stations** — список-таблица ПК с фильтром по зоне, кнопка «Добавить».
- **/admin/map** — визуальный редактор (см. модуль 5).
- На публичной витрине — карта рендерится из `club_maps.layout` + `stations`.

### Бизнес-логика
- `specs.cpu`, `specs.gpu`, `specs.ram_gb`, `specs.monitor_hz`, `specs.peripherals: { keyboard, mouse, headset }` — все опциональны.
- `status='maintenance'` — скрывает ПК из публичной карты, но не удаляет.
- Имя ПК уникально в пределах клуба (`UNIQUE(club_id, name)`).
- `position_x`, `position_y` — в «grid units», размер сетки задаётся в `club_maps.layout.gridW/gridH`.

### Крайние случаи
- Удаление ПК при наличии будущих броней → 409, предложить «archive instead».
- Две станции на одной координате → allowed (для фантазии владельца), но warning.
- Карта ещё не создана, а станции есть → станции отображаются в виде списка (fallback).

---

## 5. Редактор карты

### User Stories
- Как владелец, я хочу drag-n-drop иконки ПК на сетке 20×15, чтобы воссоздать реальный зал.
- Как владелец, я хочу добавить стены/перегородки и подписи («Бар», «Вход»), чтобы клиенты ориентировались.
- Как владелец, я хочу сохранить карту и посмотреть превью публичной витрины.

### Модель данных — `club_maps.layout` (JSONB):
```json
{
  "gridW": 20,
  "gridH": 15,
  "cellSize": 32,
  "walls": [{"x":0,"y":0,"w":20,"h":1}],
  "labels": [{"x":5,"y":8,"text":"BAR","rotation":0}],
  "decorations": [{"type":"door","x":10,"y":14}]
}
```

### API
```
PUT  /api/clubs/:clubId/map           → сохранить layout (атомарно вместе со station.position_*)
GET  /api/clubs/:clubId/map           → layout + version
POST /api/clubs/:clubId/map/duplicate?from=... → для сетей: скопировать карту
```

### Экраны
- **/admin/map-editor** — canvas с сеткой. Левая панель: зоны (цвета) → drag в canvas рождает новый ПК. Правая панель: свойства выбранной станции. Тулбар: wall/label/zoom/save/preview.
- Состояния: loading, editing, saving, saved, conflict (если version rows изменились).

### Бизнес-логика
- Автосохранение каждые 30 сек (draft в localStorage + debounced PUT).
- Optimistic concurrency: `version` инкрементируется; если `version` в запросе < current → 409.
- Размер сетки 4×4 минимум, 40×40 максимум.
- Сохранение: транзакция на `stations.position_x/y` + `club_maps.layout`.

### Крайние случаи
- Два админа редактируют одну карту → первый сохранил, второй получает 409 с предложением «принять чужие изменения».
- Пользователь закрыл вкладку без сохранения → draft восстанавливается из localStorage при следующем входе.
- Станция перемещена в координату за пределами сетки → валидация (клип к границам).

---

## 6. Публичная витрина клуба

### User Stories
- Как геймер, я хочу открыть `instagram.com/colizeum → bio ссылка → /c/colizeum-almaty` и сразу увидеть карту зала.
- Как геймер, я хочу выбрать дату и время ДО клика по ПК, чтобы увидеть только доступные места.
- Как геймер, я хочу поделиться ссылкой на свою будущую бронь в Discord-чате с командой.

### Модель данных — существующие сущности, запросы только на чтение.

### API
```
GET /api/public/clubs/:slug
   → 200 { club, zones, stations, map, promotions_active }
GET /api/public/clubs/:slug/availability?date=2026-04-25
   → 200 { slots: [{ starts_at, ends_at, station_statuses: {} }] }
```

### Экраны
- **/c/:slug** — шапка клуба, селектор даты (сегодня/завтра/календарь), слайдер времени, карта.
- Клик по свободному ПК → боттом-шит с данными ПК + кнопка «Забронировать».
- Клик по занятому → tooltip «Занято до 19:00».

### Бизнес-логика
- Default дата = сегодня, default время = ближайший свободный час.
- Грид слотов по 1 часу, min бронь = 1 час, max = 12 часов.
- Realtime обновление статусов станций (polling каждые 30 сек или WebSocket/Realtime-канал).
- PWA-манифест для установки «на главный экран».

### Крайние случаи
- Клуб закрыт в выбранный час → слоты дизейблятся.
- Выбрана дата в прошлом → календарь не даёт выбрать.
- Клуб закрыт на целый день (`status='paused'`) → баннер «клуб временно не принимает брони».

---

## 7. Бронирование

### User Stories
- Как геймер, я хочу забронировать один ПК на 3 часа в один клик.
- Как геймер, я хочу получить SMS с кодом брони и QR-код, чтобы показать его админу.
- Как геймер, я хочу отменить бронь за 2 часа без штрафа.
- Как админ, я хочу видеть список броней на сегодня отсортированный по времени.
- Как админ, я хочу пометить клиента как пришедшего (check-in).

### Модель данных — `bookings`, `booking_stations`.

### API
```
POST /api/bookings
  body: { club_id, station_ids: [uuid], starts_at, ends_at, notes? }
  → 201 { booking, qr_url } | 400 (validation) | 409 (slot occupied) | 403 (banned/blacklisted)
GET  /api/bookings/:id
  → 200 { booking, stations, user } (owner OR club admin)
GET  /api/bookings/mine
  → 200 { upcoming: [], past: [] }
GET  /api/admin/clubs/:clubId/bookings?date=&status=
  → 200 { bookings: [...] }
POST /api/bookings/:id/cancel
  body: { reason? }
  → 200 | 403 | 409 (already checked_in)
POST /api/admin/bookings/:id/check-in
  → 200 { booking } | 403
POST /api/admin/bookings/:id/complete
  → 200 | 403
POST /api/admin/bookings/:id/no-show
  → 200 (триггерит reputation-пересчёт) | 403
```

### Экраны
- **Bottom-sheet "Оформить бронь"** (публичная витрина): summary (ПК, время, цена), поле телефона, кнопка «Получить код» → OTP-верификация inline → кнопка «Забронировать».
- **/my/bookings** — мои брони с QR, кнопка «Отменить».
- **/admin/bookings** — табличка live-обновляемая, фильтры по дате/статусу, быстрые действия (check-in, no-show).
- **/admin/bookings/today-board** — режим «большого экрана» для ресепшена: список на сегодня, громкое уведомление о новой брони.

### Бизнес-логика
- При POST: в одной транзакции — insert booking + booking_stations + `SELECT ... FOR UPDATE` на конкурирующие записи, чтобы не было двойных броней.
- Overlap-проверка: нельзя бронировать station, если есть `booking` со статусом IN `('pending','confirmed','checked_in')` и пересечением `[starts_at, ends_at)`.
- `booking_code` — 8 символов из алфавита `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, префикс `CB-`.
- `total_amount = Σ(booking_stations.price_amount)`; `price_amount = zone.price_per_hour * hours * (1 - promotion_discount)`.
- Минимальный зазор между бронями одного ПК — 0 минут (MVP), настраиваемый в v2.
- Отмена допустима если `starts_at - now > 2 часа`. Позже — только админом.
- Автоматическая смена статуса `pending → confirmed` сразу после успешного OTP (для телефон-аутентификации OTP и есть подтверждение).
- Cron-задача: каждые 15 мин — `confirmed → no_show` если `starts_at + 30 min < now() AND checked_in_at IS NULL`.
- Cron: `checked_in → completed` когда `ends_at < now()`.

### Крайние случаи
- Двое нажали «Забронировать» одновременно на один ПК → первый выигрывает (409 второму).
- Клиент забронировал и отменил 5 раз подряд → rate limit: max 10 активных будущих броней на user.
- Бронь «перехлёстывает» закрытие клуба → 400 с сообщением «клуб закрыт в это время».
- Бронь длиннее 12 часов → 400.
- Пользователь в бане (`user_reputation.banned_until > now()`) → 403.
- Пользователь в чёрном списке клуба (v2) → 403.

---

## 8. Групповое бронирование

### User Stories
- Как капитан команды, я хочу забронировать 5 соседних ПК на 4 часа одним действием.
- Как капитан, я хочу, чтобы при занятости хотя бы одного ПК из пяти — вся операция отменялась.
- Как админ, я хочу видеть групповые брони отдельной иконкой.

### API
```
POST /api/bookings/group
  body: { club_id, station_ids: [uuid], starts_at, ends_at, team_name?, notes? }
  → 201 { booking } | 409 (один из ПК занят) | 400
```

### Экраны
- На публичной витрине — тумблер «Групповая бронь» → shift+click или rectangle-select в карте выделяет диапазон ПК.
- В Bottom-sheet показывается суммарная стоимость и список выбранных мест.

### Бизнес-логика
- Один `bookings`-row, `is_group=true`, несколько `booking_stations`.
- Атомарность: транзакция на все `station_ids`; ошибка хоть по одному → откат.
- Депозит обязателен в v2 (Pro-тариф) для групп > 3 ПК на > 2 часа.

### Крайние случаи
- Капитан хочет добавить ПК к существующей групповой брони → v2 (MVP не поддерживает).
- Один из ПК в группе ушёл в maintenance после создания → все ПК этой брони становятся `needs_reassignment`, админ уведомляется.

---

## 9. Уведомления

### User Stories
- Как админ на рецепции, я хочу слышать громкий звук + видеть тост при новой брони.
- Как геймер, я хочу получить SMS за 30 минут до брони с напоминанием.
- Как владелец, я хочу дублирование броней в Telegram-бота (настраивается в профиле клуба).

### Модель данных — `notifications_log`.

### API
```
POST /api/admin/webpush/subscribe
  body: { subscription: {endpoint, keys} }
  → 201 (сохраняется в club_members.push_subscription)
POST /api/clubs/:id/integrations/telegram
  body: { chat_id } (после /start у бота)
  → 200
```

### Триггеры (серверные события)
| Событие | Кому | Канал (MVP) | Канал (v2) |
|---|---|---|---|
| `booking.created` | user | Email («Бронь CB-8F3K2X на 25.04 19:00, ПК-12 + ссылка с QR») | + SMS |
| `booking.created` | club admins on shift | Web Push (VAPID) + звук | + Telegram-бот |
| `booking.reminder` (T–30 мин) | user | Email | SMS |
| `booking.cancelled_by_user` | club admins | Web Push | + Telegram |
| `booking.no_show` | user | Email | + SMS |
| `booking.checked_in` | user | Web Push (если подписан) | — |

### Бизнес-логика
- Очередь: событие → insert `notifications_log(status=queued)` → воркер (cron каждые 30 сек или Supabase Edge Function по таймеру) отправляет → `sent` или `failed`.
- Retry: 3 попытки с экспонентой (1m, 5m, 15m).
- Email в MVP — через Supabase Auth templates для welcome/confirmation и через Resend/SMTP (минимальная интеграция) для транзакционных писем. Провайдер — на усмотрение (по умолчанию: Resend).
- Web Push — VAPID ключи в env, подписка привязана к `club_members`. Активируется на `/admin/today-board` (пользователь нажал «Включить уведомления»).

### Крайние случаи
- Email bounce → помечаем `notifications_log.status='failed'`, уведомление в audit.
- Пользователь отписался от web push → удалить подписку, не retry.
- Пользователь открыл `/admin/today-board` на двух устройствах → обе подписки валидны, уведомление приходит на оба.

---

## 10. Рейтинг и репутация клиентов

### User Stories
- Как система, я должна автоматически снижать рейтинг на no-show.
- Как админ, я хочу видеть рейтинг клиента при входе (цветной бейдж).
- Как пользователь, я хочу видеть свой рейтинг и правила.

### Модель данных — `user_reputation`.

### API
```
GET /api/users/me/reputation          → 200 { score, total_bookings, no_shows, banned_until, history: [...] }
GET /api/admin/users/:id/reputation   → 200 (если user имеет бронь в клубе админа)
```

### Правила пересчёта (SECURITY DEFINER функция)
| Триггер | Эффект на score |
|---|---|
| `booking.created` | total_bookings +=1 |
| `booking.completed` | +5 |
| `booking.cancelled_by_user` (<2h) | –15, cancellations +=1 |
| `booking.no_show` | –30, no_shows +=1 |
| 2-й no_show за 30 дней | `banned_until = now() + 7d` в этом клубе (MVP) |
| 3-й no_show за 90 дней | глобальный бан 14 дней |
| score < 40 и no_shows ≥ 3 | глобальный бан 30 дней |

### Крайние случаи
- Админ по ошибке отметил no-show → кнопка «Отменить no-show» в течение 24 часов, автоматический пересчёт.
- Пользователь оспаривает no-show (контактирует с поддержкой) → super-admin может вручную править.

---

## 11. Админ-панель клуба

### User Stories
- Как админ, я хочу видеть «всё, что важно сейчас» на одном экране.
- Как админ, я хочу одним кликом сделать check-in для пришедшего клиента.
- Как владелец, я хочу смотреть статистику по дням/неделям.

### Экраны
- **/admin** — главная: счётчики (сегодня: броней / выручка / свободно сейчас), live-список на ближайшие 4 часа, последние 5 новых броней.
- **/admin/today-board** — полноэкранный режим для планшета на рецепции: большая таблица броней на сегодня, сортировка по времени, цветовая маркировка (скоро / сейчас / прошло), подсветка + звук новой брони.
- **/admin/bookings** — все брони с фильтрами (дата-диапазон, статус, зона, поиск по имени/телефону/коду).
- **/admin/clients** — список клиентов с рейтингами, поиск по телефону.
- **/admin/stations** — список ПК + кнопки maintenance/active.
- **/admin/settings** — настройки клуба, админы, Telegram-бот.

### Бизнес-логика
- Role-based sidebar: `owner` видит всё, `admin` не видит биллинг/удаление клуба.
- Live-обновление: WebSocket или SSE каждые 10–30 сек для today-board.
- Экспорт в CSV: брони за период, клиенты, финансы.

### Крайние случаи
- Админ потерял соединение → UI показывает «offline» баннер, данные из кеша, при восстановлении — ресинк.
- Два админа одновременно check-in одного клиента → идемпотентность (status уже `checked_in` → 200 no-op).

---

## 12. Чёрный список

### User Stories
- Как админ, я хочу добавить клиента в чёрный список клуба с причиной.
- Как админ, я хочу временный бан (7 дней) или постоянный.
- Как клиент в черном списке, я хочу видеть сообщение «вы не можете бронировать в этом клубе».

### Модель данных — `blacklists`.

### API
```
POST   /api/admin/clubs/:clubId/blacklist
  body: { user_id, reason, expires_at? }
  → 201 | 403
DELETE /api/admin/clubs/:clubId/blacklist/:userId → 204 | 403
GET    /api/admin/clubs/:clubId/blacklist          → 200 { entries: [...] }
```

### Бизнес-логика
- При `POST /api/bookings` — проверка: `EXISTS(blacklists WHERE club_id=? AND user_id=? AND (expires_at IS NULL OR expires_at > now()))` → 403 с причиной.
- Черный список одного клуба НЕ влияет на другие клубы.

### Крайние случаи
- Пользователь забанен постоянно → может видеть публичную витрину, но при попытке брони — сразу 403.
- `expires_at` прошла → запись не удаляется, но перестаёт работать (можно сделать cron cleanup раз в неделю).

---

## 13. «Горящие места»

### User Stories
- Как владелец, я хочу включить –30% на General-зону по будням с 10:00 до 16:00.
- Как геймер, я хочу видеть бейдж «🔥 –30%» на доступных ПК в такие часы.
- Как система, я должна применять промо при расчёте цены автоматически.

### Модель данных — `promotions`.

### API
```
POST   /api/admin/clubs/:clubId/promotions
  body: { name, discount_percent, applies_to, zone_id?, time_from, time_to, weekdays }
  → 201 | 403
GET    /api/public/clubs/:slug/promotions → 200 { active: [...] }  (публично, для отображения бейджей)
PATCH  /api/admin/promotions/:id → 200 | 403
DELETE /api/admin/promotions/:id → 204 | 403
```

### Бизнес-логика
- При расчёте цены бронирования: `price_per_hour * hours * (1 - max(applicable_promotions.discount_percent) / 100)`.
- Если несколько промо применимы — берётся максимальная скидка (не складываются).
- `applies_to = 'all'` — на все ПК клуба, `'zone'` — на один зону, `'station'` — позже (v3).
- Валидация: `time_from < time_to`, `weekdays` подмножество `{1..7}`.

### Крайние случаи
- Бронь пересекает границу промо-времени → рассчитывается по часам: 1 час в промо со скидкой + 1 час вне промо без.
- Промо выключено в момент брони, но бронь создана раньше → уже зафиксированная цена сохраняется.

---

## 14. Платежи: депозиты

### User Stories
- Как клиент на Pro-клубе, я хочу внести депозит 500 ₸ через Kaspi Pay, чтобы подтвердить бронь.
- Как клиент, я хочу получить возврат депозита автоматически при check-in.
- Как владелец, я хочу понимать % оплаченных vs. бесплатных броней.

### Модель данных — `payment_intents`.

### API
```
POST /api/bookings/:id/deposit
  body: { provider: 'kaspi'|'freedom' }
  → 200 { redirect_url | payment_page } | 403
POST /api/payments/webhook/kaspi    (провайдер-вебхук, сигнатура!)
POST /api/payments/webhook/freedom
GET  /api/payments/:id              → 200 { status } (owner OR club admin)
POST /api/admin/bookings/:id/refund-deposit
  → 200 | 403
```

### Бизнес-логика
- Сумма депозита: 500 ₸ default, настраивается в `clubs.deposit_amount` (добавить колонку).
- При создании брони на Pro-клубе: `bookings.status='pending'` до `payment_intents.status='paid'`, иначе через 15 мин — автоотмена.
- Webhook-обработка: валидация подписи провайдера (HMAC), идемпотентность по `provider_ref`.
- При `booking.checked_in` → автоматический refund депозита (async job).
- При `booking.no_show` → депозит не возвращается, зачисляется в `clubs.deposit_income`.

### Крайние случаи
- Webhook пришёл дважды → идемпотентность по `provider_ref`, no-op при duplicate.
- Webhook не пришёл за 15 мин → polling статуса у провайдера (fallback).
- Возврат не прошёл технически → фиксируется в `payment_intents.status='refund_failed'`, уведомление super-admin.
- Частичный refund (если был downgrade tarifa) — не поддерживается в MVP.

---

## 15. Подписки B2B

### User Stories
- Как владелец, я хочу оплатить тариф Start на месяц через Kaspi.
- Как владелец, я хочу понижать/повышать план.
- Как система, я должна блокировать фичи Pro, если subscription не активна.

### Модель данных — `subscriptions`, `payment_intents(type='subscription')`.

### API
```
GET  /api/admin/clubs/:id/subscription   → 200 { plan, status, period, next_invoice }
POST /api/admin/clubs/:id/subscription/checkout
  body: { plan, billing_period }
  → 200 { redirect_url }
POST /api/admin/clubs/:id/subscription/cancel
  → 200 { cancel_at_period_end: true }
POST /api/payments/webhook/subscription  (от провайдера)
```

### Бизнес-логика
- Trial: первые 14 дней на Pro — бесплатно, далее auto-renew (требует согласия).
- Гейтинг фич:
  - `promotions.create` → требует plan IN ('pro','network')
  - `blacklists.add` → требует plan IN ('pro','network')
  - `payment_intents.create (deposit)` → требует plan IN ('pro','network')
  - `analytics.advanced` → требует plan IN ('pro','network')
  - Множественные локации → `network`.
- Downgrade: применяется в конце периода. Даунгрейд с Pro → Start сразу деактивирует промо/блэклисты (сохраняются, но не применяются).

### Крайние случаи
- Subscription просрочилась (past_due) → гейтинг применяется сразу, но базовые функции остаются (бронирование продолжает работать на free).
- Смена плана посередине периода → prorated billing (v2, в MVP — только end-of-period).

---

## 16. Аналитика

### User Stories
- Как владелец, я хочу видеть загрузку зала по часам за последнюю неделю.
- Как владелец, я хочу понять, какие ПК популярны, какие простаивают.
- Как сеть, я хочу сравнить выручку локаций.

### Источник — агрегации из `bookings`, `booking_stations`, `stations`.

### API
```
GET /api/admin/clubs/:id/analytics/occupancy?from=&to=&grouping=hour|day
   → 200 { series: [{ts, occupancy_pct}] }
GET /api/admin/clubs/:id/analytics/revenue?from=&to=
   → 200 { total, by_day: [], by_zone: [] }
GET /api/admin/clubs/:id/analytics/top-stations?from=&to=
   → 200 { top: [{station_id, name, bookings_count, revenue}] }
GET /api/admin/clubs/:id/analytics/clients?from=&to=
   → 200 { new, returning, churn }
```

### Экраны
- **/admin/analytics** — дашборд с виджетами:
  1. Heatmap загрузки (hours × weekdays) за 30 дней
  2. Revenue-график по дням
  3. Топ/антитоп станций
  4. Retention-когорты (новые vs. возвращающиеся)
  5. Conversion: просмотры витрины → брони

### Бизнес-логика
- Агрегации выполняются запросами в реальном времени (MVP). При росте нагрузки → materialized views + refresh каждые 30 мин.
- Occupancy = Σ(booked_hours) / Σ(available_hours) для period.
- Retention: client с ≥2 броней за период — returning.

### Крайние случаи
- Период в будущем → пустой ответ.
- Нет данных за период → все поля 0.
- Network-тариф: cross-club view — добавить `?club_ids=a,b,c`.

---

## 17. Super-admin

### User Stories
- Как SaaS-владелец, я хочу видеть список всех клубов, их подписки, MRR.
- Как support, я хочу зайти в админку любого клуба для отладки.
- Как оператор, я хочу вручную создать invoice или продлить подписку.

### API
```
GET  /api/super/clubs?status=&plan=     → 200 { clubs: [...] }
PATCH /api/super/clubs/:id              body: partial { status, subscription_plan }
POST /api/super/clubs/:id/impersonate    → 200 { impersonation_token, expires_in } (audit-logged)
GET  /api/super/metrics                  → 200 { total_clubs, active_subs, mrr, churn_30d, bookings_today }
POST /api/super/users/:id/ban           → 200 (глобальный бан)
GET  /api/super/audit-log?actor=&action= → 200
```

### Экраны
- **/super/clubs** — таблица клубов.
- **/super/metrics** — KPI дашборд.
- **/super/audit** — фильтруемый лог действий.

### Бизнес-логика
- Доступ только для `users.role='super_admin'`.
- Impersonation: генерирует временный session для `club_admin`, все действия логируются с `actor=super_admin_id, as_user=club_admin_id`.
- 2FA для `super_admin` обязательна (TOTP).

### Крайние случаи
- Super-admin пытается заимпрсонировать сам себя → 400.
- Impersonation-токен истёк → редирект обратно на /super.

---

## Non-functional требования

- **Perf**: LCP ≤ 2s, TTI ≤ 3s на 4G, P95 API ≤ 300ms.
- **A11y**: WCAG AA, полная клавиатурная навигация в админке.
- **Security**: CSRF-защита, rate-limit, sanitization пользовательского ввода (XSS), все секреты — из env, логирование всех mutation-операций в `audit_log`.
- **i18n**: RU default, KZ, EN. Валюта ₸ (MVP), архитектура допускает мульти-валютность.
- **PWA**: manifest.json, service worker, работа оффлайн (кеш витрины + мои брони), установка на home screen.
- **Testing**: unit-тесты для бизнес-логики (overlap, reputation, pricing), integration-тесты для RLS, e2e для критического флоу «бронь → check-in».
- **Observability**: structured logs, tracing критичных операций (booking.create), алёрт на ошибки webhook'ов платежей.

## Приоритизация

| Модуль | MVP | v2 |
|---|---|---|
| 1. Auth | ✅ | — |
| 2. Clubs & Members | ✅ | — |
| 3. Zones | ✅ | — |
| 4. Stations | ✅ | — |
| 5. Map editor | ✅ (базовый) | Расширенные декорации |
| 6. Public showcase | ✅ | — |
| 7. Bookings | ✅ | — |
| 8. Group bookings | Частично (одиночные с множеством ПК) | Полноценный UX |
| 9. Notifications | ✅ (Email + WebPush) | SMS, Telegram-бот |
| 10. Reputation | ✅ | — |
| 11. Club admin | ✅ | — |
| 12. Blacklist | — | ✅ |
| 13. Promotions | — | ✅ |
| 14. Deposits | — | ✅ |
| 15. B2B Subscriptions | — | ✅ |
| 16. Analytics | Базовый (счётчики) | Полный дашборд |
| 17. Super-admin | Минимум (список клубов) | Полный |
