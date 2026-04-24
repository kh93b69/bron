# CyberBook — AI-config

Lightweight SaaS для бронирования ПК в кибер-клубах. PWA-витрина + админ-панель клуба. Подробности — в `SPEC.md`.

## Стек

- **Хостинг**: Railway (Node.js runtime + managed Supabase)
- **VCS / CI**: GitHub → Railway auto-deploy (push в `main` → прод, push в PR → preview)
- **DB / Auth / Realtime / Storage**: Supabase (Postgres 15 + RLS)
- **Фреймворк**: Next.js 15 (App Router, Server Actions, Route Handlers) + React 19
- **Язык**: TypeScript strict mode
- **UI**: Tailwind CSS v4 + shadcn/ui + Lucide icons
- **Данные**: Supabase JS SDK + `@supabase/ssr` + TanStack Query v5
- **Формы/валидация**: React Hook Form + Zod (+ `@hookform/resolvers`)
- **Real-time**: Supabase Realtime (канал `club:<id>:bookings`)
- **Auth (MVP)**: Supabase Auth — **Email OTP** (`signInWithOtp({ email })`) для игроков и админов. Phone/SMS — v2.
- **Платежи**: ❌ не в MVP. Депозиты/подписки Kaspi/Freedom — v2 (см. `.claude/rules/payments-rules.md`).
- **Тесты**: Vitest (unit/integration) + Playwright (e2e) — после скелета.

## Архитектура

```
src/                 # код приложения
  app/               # маршруты (публичная витрина /c/:slug + админка /admin + /super)
  components/        # переиспользуемые UI-компоненты
  server/            # бизнес-логика (bookings, reputation, notifications, payments)
  lib/               # утилиты, клиенты внешних сервисов
  types/             # общие TS-типы
db/ | supabase/      # миграции SQL + серверные функции (по стеку)
public/              # PWA-манифест, иконки, service worker
.claude/             # агенты, rules, skills
```

## Ключевые конвенции

- **Identifiers в коде — на английском** (таблицы, колонки, типы, компоненты). **Контент и комментарии — русские** (пользователи говорят на RU/KZ).
- **Currency**: суммы в `bookings.total_amount`, `zones.price_per_hour` хранятся в тенге (integer). В `payment_intents.amount` — в тийинах (`₸ * 100`) для совместимости с эквайрингом.
- **Timezone**: всё в UTC на бэке, отображение в `clubs.timezone`.
- **RLS обязательна** для каждой таблицы. Никакой таблицы без политики в той же миграции.
- **Booking overlap**: любая операция, меняющая bookings, идёт в транзакции с `SELECT ... FOR UPDATE` на конфликтующие строки.
- **Audit log**: все mutation в `bookings`, `blacklists`, `subscriptions`, `payment_intents`, `club_members` — пишутся в `audit_log`.
- **Webhooks платежей**: всегда идемпотентны по `provider_ref`, валидация подписи обязательна.
- **i18n**: все пользовательские строки через `t('ключ')`. Дефолт RU, поддержка KZ/EN.
- **PWA-first**: витрина работает с потерей сети (кеш последнего состояния).

## Роли

- `player` — геймер, может бронировать, видеть свои брони и рейтинг
- `club_admin` — работает в админке клуба (check-in, отмены, блэклист)
- `owner` — подмножество `club_admin` с правом на биллинг, удаление клуба, управление админами
- `super_admin` — SaaS-оператор (просмотр всех клубов, impersonation, аудит)

## Правила Claude Code

1. **Spec-first**. Перед изменениями любого модуля — читай соответствующий раздел `SPEC.md`. Не придумывай поведение, которого нет в спеке.
2. **Новая фича** = новый файл по `SPEC_TEMPLATE.md` → согласование → реализация через skill `implement-feature`.
3. **Изменение схемы БД** — только через skill `create-migration`. Миграции не редактируются постфактум.
4. **Subagents**:
   - DB-схема, RLS, индексы, миграции → `database-architect`
   - API, серверная логика, уведомления → `backend-engineer`
   - UI, компоненты, формы, PWA → `frontend-developer`
   - Code review, безопасность, проверка RLS → `qa-reviewer` (read-only)
   - Платежи, депозиты, подписки, webhooks → `payments-specialist`
5. **Context7 MCP** — использовать ПЕРЕД написанием кода для любой внешней библиотеки/API (актуальная документация). Устаревшие snippets из памяти модели — запрещены.
6. **Rules активируются по globs**. Открыл файл — соответствующий rule в контексте. Детали — в `.claude/rules/`.

## Команды разработчика

```bash
pnpm install                             # установка
pnpm dev                                 # Next dev
pnpm supabase start | stop               # локальный Supabase (Postgres + Studio + Auth)
pnpm supabase migration new <name>       # новая миграция
pnpm supabase db push                    # применить на linked проект
pnpm supabase db reset                   # локально: снести + применить всё + seed
pnpm db:types                            # TS-типы из схемы
pnpm seed                                # тестовые данные
pnpm lint && pnpm typecheck              # проверки
pnpm test && pnpm test:e2e               # vitest + playwright
pnpm build && pnpm start                 # прод (Railway вызывает автоматически, PORT подставляется)
```

## Безопасность (short)

- Никаких секретов в репозитории. `.env` в `.gitignore`, public env через `NEXT_PUBLIC_` (или аналог).
- Rate-limits: auth (3 OTP/15 мин/номер), bookings (10 активных будущих / user), SMS (5/час/номер).
- CSRF на state-changing запросах. Валидация всех входов (zod/yup).
- Super-admin — обязательно 2FA (TOTP).

## Где искать детали

- `SPEC.md` — спецификация по каждому из 17 модулей
- `PROJECT_IDEA.md` — контекст продукта, монетизация, конкуренты
- `.claude/rules/` — контекстные правила (db, api, ui, security, payments)
- `.claude/skills/` — воркфлоу для повторяющихся задач
- `.claude/agents/` — специализации субагентов

## Приоритет MVP

Модули 1–11 (см. `SPEC.md` раздел «Приоритизация»). v2 — модули 12–17 (блэклист, промо, платежи, подписки, аналитика, super-admin).
