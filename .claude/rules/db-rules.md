---
name: db-rules
description: Правила для работы с базой данных и миграциями — обязательные RLS, типы, индексы, транзакционность
globs:
  - "supabase/migrations/**/*.sql"
  - "db/**/*.sql"
  - "src/server/**/*.ts"
---

# DB Rules — CyberBook

## Обязательные правила (BLOCKER при нарушении)

1. **RLS для каждой таблицы в той же миграции**, где таблица создаётся.
   ```sql
   CREATE TABLE foo (...);
   ALTER TABLE foo ENABLE ROW LEVEL SECURITY;
   CREATE POLICY foo_select ON foo FOR SELECT USING (...);
   CREATE POLICY foo_insert ON foo FOR INSERT WITH CHECK (...);
   ```
   Без этих трёх строк миграция не принимается.

2. **Типы строго из SPEC.md**:
   - ID — `uuid` DEFAULT `gen_random_uuid()`
   - Деньги — `integer` в тенге (или тийинах для `payment_intents`)
   - Временные метки — `timestamptz`
   - Гибкие поля — `jsonb` с валидацией на приложении
   - Enum-like — `text` с `CHECK (col IN (...))`

3. **FK всегда с `ON DELETE`**:
   - `CASCADE` — для отношений владения (club → zones, club → stations)
   - `RESTRICT` — для исторических ссылок (booking_stations.station_id)
   - `SET NULL` — только для опциональных ссылок

4. **Индексы — в одной миграции с таблицей.** Обязательные для CyberBook:
   - `bookings(club_id, starts_at)`
   - `bookings(user_id, created_at DESC)`
   - `booking_stations(station_id)`
   - Частичный `bookings(club_id, starts_at, ends_at) WHERE status IN ('pending','confirmed','checked_in')`
   - `notifications_log(status, created_at) WHERE status='queued'`
   - `payment_intents(provider_ref)` — UNIQUE (идемпотентность webhook'ов)

5. **Overlap-проверки только через транзакцию с `SELECT ... FOR UPDATE`.** Любая логика вида «SELECT-проверил-INSERT» без блокировки — BLOCKER.

6. **`SECURITY DEFINER` функции для**:
   - `apply_reputation_event(user_id, event)` — репутация не пишется напрямую
   - `auto_no_show()`, `auto_complete()` — cron-вызываемые
   - `create_booking(...)` — если вся логика в БД (предпочтительно)

## Шаблон миграции

```sql
-- supabase/migrations/YYYYMMDDHHmm_<snake_case>.sql

-- 1. Таблица
CREATE TABLE table_name (...);

-- 2. Индексы
CREATE INDEX idx_... ON table_name (...);

-- 3. Constraints (CHECK, UNIQUE composite)
ALTER TABLE table_name ADD CONSTRAINT ...;

-- 4. RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY ..._select ON table_name FOR SELECT USING (...);
CREATE POLICY ..._insert ON table_name FOR INSERT WITH CHECK (...);
CREATE POLICY ..._update ON table_name FOR UPDATE USING (...) WITH CHECK (...);
CREATE POLICY ..._delete ON table_name FOR DELETE USING (...);

-- 5. Комментарии для сложных колонок
COMMENT ON COLUMN table_name.layout IS '{gridW, gridH, walls, labels} — см. SPEC §5';

-- 6. Триггеры (если нужны для updated_at)
CREATE TRIGGER ... BEFORE UPDATE ON ... FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## Именование

- Таблицы: `snake_case`, множественное число (`bookings`, `clubs`, `zones`). Исключения: `audit_log`, `user_reputation` (один-к-одному с users).
- Колонки: `snake_case`, без префикса таблицы (`id` не `booking_id` в таблице `bookings`).
- Индексы: `idx_<table>_<columns>` или `idx_<table>_<purpose>`.
- Политики: `<table>_<action>_<qualifier>` — `bookings_select_owner_or_admin`.
- Миграции: `YYYYMMDDHHmm_short_description.sql` (например, `202604241030_create_bookings.sql`).

## Запреты (антипаттерны)

- ❌ `USING (true)` в RLS без комментария-обоснования
- ❌ `float` / `numeric` для денег
- ❌ `timestamp` без `tz` — всегда `timestamptz`
- ❌ `VARCHAR(n)` — использовать `text` (ограничение в приложении/CHECK)
- ❌ `CREATE TABLE IF NOT EXISTS` — скрывает ошибки миграций
- ❌ Редактирование применённой миграции — всегда новая миграция
- ❌ `DROP TABLE`/`DROP COLUMN` без явного обсуждения в PR (потеря данных)
- ❌ Писать в `user_reputation` / `audit_log` / `payment_intents` из клиентского кода — только через серверные функции
