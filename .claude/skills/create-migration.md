---
name: create-migration
description: Создание SQL-миграции для CyberBook — шаблон, именование, обязательные блоки (таблица + индексы + RLS + triggers), проверка применения.
---

# Skill: create-migration

## Вход

- Описание изменения схемы (новая таблица / новая колонка / новый индекс / новая функция)
- Ссылка на раздел в `SPEC.md`, где описана сущность

## Алгоритм

### Шаг 1 — Именование

Формат: `YYYYMMDDHHmm_<snake_case_description>.sql`

Примеры:
- `202604250930_create_bookings.sql`
- `202604251430_add_blacklists.sql`
- `202604261100_add_clubs_timezone_column.sql`
- `202604270800_create_reputation_function.sql`

Время — момент создания миграции, не выполнения. Локальное время разработчика.

### Шаг 2 — Структура файла

```sql
-- supabase/migrations/YYYYMMDDHHmm_<name>.sql
-- Description: 1-2 предложения на русском: что и зачем
-- Spec: ссылка на раздел SPEC.md (#модуль-N)

BEGIN;

-- =================================
-- 1. ТАБЛИЦЫ (если добавляются)
-- =================================
CREATE TABLE <name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ...
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =================================
-- 2. ИНДЕКСЫ
-- =================================
CREATE INDEX idx_<table>_<columns> ON <table> (...);

-- =================================
-- 3. CHECK / UNIQUE constraints
-- =================================
ALTER TABLE <table> ADD CONSTRAINT <name>_status_check
  CHECK (status IN ('...'));

-- =================================
-- 4. RLS
-- =================================
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

CREATE POLICY <table>_select_... ON <table>
  FOR SELECT USING (...);

CREATE POLICY <table>_insert_... ON <table>
  FOR INSERT WITH CHECK (...);

CREATE POLICY <table>_update_... ON <table>
  FOR UPDATE USING (...) WITH CHECK (...);

-- =================================
-- 5. ТРИГГЕРЫ (updated_at, audit)
-- =================================
CREATE TRIGGER <table>_set_updated_at
  BEFORE UPDATE ON <table>
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =================================
-- 6. SECURITY DEFINER функции (если нужны)
-- =================================
CREATE OR REPLACE FUNCTION <name>(...) RETURNS ...
  LANGUAGE plpgsql SECURITY DEFINER AS $$
...
$$;
REVOKE ALL ON FUNCTION <name> FROM public;
GRANT EXECUTE ON FUNCTION <name> TO service_role;

-- =================================
-- 7. КОММЕНТАРИИ (для сложных полей)
-- =================================
COMMENT ON COLUMN <table>.<column> IS '...';

COMMIT;
```

### Шаг 3 — Обязательные блоки

Для **новой пользовательской таблицы**:
- [ ] PK `uuid DEFAULT gen_random_uuid()`
- [ ] `created_at timestamptz DEFAULT now()`
- [ ] `updated_at timestamptz DEFAULT now()` + trigger (если апдейтится)
- [ ] FK с явным `ON DELETE`
- [ ] `ENABLE ROW LEVEL SECURITY`
- [ ] Минимум 3 политики (SELECT, INSERT, UPDATE)
- [ ] Индексы под известные запросы

Для **новой колонки**:
- [ ] `NOT NULL` с `DEFAULT`, или nullable (без default)
- [ ] Если NOT NULL без default на большой таблице → добавить default сразу
- [ ] Обновить существующие RLS-политики, если колонка влияет на доступ
- [ ] Обновить индексы, если колонка будет в WHERE

Для **новой функции**:
- [ ] `SECURITY DEFINER` если пишет в таблицу с RLS
- [ ] `REVOKE ALL FROM public` + `GRANT EXECUTE TO service_role` (или нужная роль)
- [ ] Документирована через `COMMENT ON FUNCTION`

### Шаг 4 — Применение и проверка

Локально:
```bash
# применить
supabase migration up
# или через psql:
psql $DATABASE_URL -f supabase/migrations/<file>.sql
```

Smoke-тесты после применения:
1. `\d <table>` — убедись, что структура соответствует ожиданиям
2. Попытка INSERT под правильным user → ok
3. Попытка SELECT под чужим user → 0 rows
4. Попытка UPDATE под чужим user → 0 rows affected
5. `EXPLAIN ANALYZE` на ключевом запросе → индекс используется

### Шаг 5 — Не редактируй применённую миграцию

Если миграция уже на staging/prod — **новая миграция**. Редактирование = рассинхронизация.

Откат: только через обратную миграцию (`DROP INDEX`, `DROP COLUMN`, `ALTER ... DROP CONSTRAINT`).

## Частые паттерны для CyberBook

### RLS: проверка принадлежности клубу
```sql
USING (
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = <table>.club_id
      AND cm.user_id = auth.uid()
  )
)
```

### RLS: публичное чтение
```sql
CREATE POLICY <table>_select_public ON <table>
  FOR SELECT USING (true);
-- Но! Только для реально публичных данных (clubs, zones, stations, promotions)
-- Не добавляй "для удобства" на таблицы с PII
```

### RLS: SELECT владельцу или админу клуба
```sql
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = <table>.club_id AND cm.user_id = auth.uid()
  )
)
```

### updated_at trigger (один раз на проект)
```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
```

## Антипаттерны

- ❌ Миграция без `ENABLE ROW LEVEL SECURITY` для таблицы с user-данными
- ❌ Редактирование применённой миграции
- ❌ `DROP TABLE` / `DROP COLUMN` без явного обсуждения в PR
- ❌ Новая таблица без индексов (планирование «потом добавим» не работает)
- ❌ Nullable колонка там, где значение обязательно (допиши `DEFAULT` вместо nullable)
- ❌ `varchar(n)` вместо `text` с CHECK
- ❌ Миграция без BEGIN/COMMIT (одна ошибка — частичное применение)
