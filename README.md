# CyberBook

Lightweight SaaS для бронирования ПК в кибер-аренах. PWA-витрина + админ-панель клуба.

- **Stack**: Railway · GitHub · Supabase · Next.js 15 · TypeScript · Tailwind v4 · shadcn/ui · React Query · Zod
- **Auth MVP**: Email OTP через Supabase Auth
- **Платежи/SMS**: ❌ в MVP (см. v3 роадмапа)

Методология — Spec-First. Исходные документы: [PROJECT_IDEA.md](PROJECT_IDEA.md), [SPEC.md](SPEC.md), [CLAUDE.md](CLAUDE.md).

---

## Quick start (local)

### 1. Установить инструменты (один раз)

```bash
# Node 20 + pnpm (через corepack)
corepack enable

# Supabase CLI (локальный Postgres + Studio + Auth эмулятор)
brew install supabase/tap/supabase      # macOS
# npm i -g supabase — альтернатива
```

### 2. Склонировать и установить

```bash
git clone <repo-url> cyberbook
cd cyberbook
pnpm install
cp .env.example .env.local
```

### 3. Поднять Supabase локально + применить миграции

```bash
pnpm supabase start                     # поднимает Postgres, Studio, Inbucket (email эмулятор)
pnpm supabase db reset                  # применяет все миграции из supabase/migrations
pnpm seed                               # создаёт тестовый клуб + owner + 40 ПК
```

CLI напечатает local URLs. Укажи их в `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key из supabase status>`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key из supabase status>`

### 4. Запустить Next.js

```bash
pnpm db:types                            # сгенерировать TS-типы из локальной БД
pnpm dev                                 # http://localhost:3000
```

### 5. Проверить работу

1. Открой `http://localhost:3000/c/demo` — публичная витрина тестового клуба.
2. Выбери ПК → интерфейс попросит email → получи код из Inbucket: `http://127.0.0.1:54324`.
3. Введи код → бронь создана.
4. Открой `http://localhost:3000/admin` — первый раз спросит onboarding, но если прошёл seed — owner уже есть.
5. Для входа как owner: `/login` → email `owner@cyberbook.local` → код в Inbucket → admin-панель.

---

## Deploy на Railway

### Первый раз

1. **Supabase cloud**: создай проект на [supabase.com](https://supabase.com). Получи `SUPABASE_URL`, `anon`, `service_role`.
2. **Связать CLI с облаком и применить миграции**:
   ```bash
   pnpm supabase link --project-ref <your-ref>
   pnpm supabase db push
   ```
3. **Resend**: зарегистрируйся на [resend.com](https://resend.com), получи `RESEND_API_KEY`. Подтверди свой домен или используй `onboarding@resend.dev` для тестов.
4. **Email-шаблон Supabase Auth**: в Dashboard → Authentication → Email Templates — поправь шаблон «Magic Link / OTP» под брендинг CyberBook (русский язык, код крупно).
5. **GitHub**: запушь репо. Создай проект на [railway.com](https://railway.com) → New Project → Deploy from GitHub repo → выбери репо.
6. **Railway Variables** (Project Settings → Variables): скопируй из `.env.example`, заполни значениями из Supabase и Resend. Railway автоматически задаёт `PORT` — не трогай.
7. **Healthcheck**: `railway.json` уже указывает `/api/health`. Первый деплой пройдёт сам.
8. **Auto-deploy**: push в `main` → Railway пересобирает и деплоит. PR-ветки → preview-деплои (если включишь в Settings).

### Cron для auto-no-show / auto-complete

В Railway: Project → + New → Cron Job:
- Command: `curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<your-railway-url>/api/cron/auto-transitions`
- Schedule: `*/15 * * * *` (каждые 15 минут)

Альтернатива: `pg_cron` в Supabase напрямую вызывает `SELECT run_auto_status_transitions();`.

---

## Как запускать новую фичу

1. Скопируй [SPEC_TEMPLATE.md](SPEC_TEMPLATE.md), опиши фичу в `features/YYYY-MM-DD_<slug>.md`.
2. Открой Claude Code в корне, напиши: «Реализуй `features/<путь>.md` через skill `implement-feature`».
3. Claude Code сам делегирует субагентам (`database-architect`, `backend-engineer`, `frontend-developer`, `qa-reviewer`), применит миграции, прогонит review.

---

## Структура проекта

```
./
├── CLAUDE.md                    — главный конфиг для Claude Code (≤120 строк)
├── PROJECT_IDEA.md              — документ идеи
├── SPEC.md                      — спецификация модулей
├── SPEC_TEMPLATE.md             — шаблон новой фичи
├── CONFIG_GENERATOR.md          — промпт пересборки .claude/
├── .claude/
│   ├── agents/                  — database-architect, backend-engineer, frontend-developer, qa-reviewer, payments-specialist (v3)
│   ├── rules/                   — db, api, ui, security, payments
│   └── skills/                  — implement-feature, create-migration
├── prompts/                     — 01 идея→спека, 02 спека→конфиг, 03 конфиг→сборка
│
├── src/
│   ├── app/                     — Next.js App Router
│   │   ├── page.tsx             — лендинг
│   │   ├── login/               — Email OTP
│   │   ├── onboarding/club/     — мастер создания клуба
│   │   ├── c/[slug]/            — публичная витрина + карта зала + bottom-sheet брони
│   │   ├── admin/               — панель клуба (дашборд, today-board, bookings)
│   │   ├── my/bookings/         — мои брони (игрок)
│   │   └── api/
│   │       ├── health           — healthcheck для Railway
│   │       ├── bookings         — создание + отмена брони (вызов RPC)
│   │       ├── admin/bookings/…/check-in|no-show
│   │       └── cron/auto-transitions
│   ├── components/              — providers + UI
│   ├── lib/
│   │   ├── env.ts               — zod-типизированный env
│   │   ├── utils.ts             — cn(), formatTenge(), hoursBetween()
│   │   └── supabase/            — client / server / middleware
│   ├── server/
│   │   ├── bookings/            — create/cancel/check-in/no-show обёртки над RPC
│   │   └── errors.ts            — AppError + маппинг PG-ошибок на HTTP-коды
│   ├── middleware.ts            — update Supabase session
│   └── types/database.ts        — плейсхолдер, перезаписывается `pnpm db:types`
│
├── supabase/
│   ├── config.toml              — CLI-конфиг локального инстанса (Email OTP включён)
│   └── migrations/
│       ├── 20260425000001_core_schema.sql    — все таблицы + RLS + индексы
│       └── 20260425000002_functions.sql      — SECURITY DEFINER: create_booking, cancel_booking,
│                                               check_in_booking, mark_no_show, run_auto_status_transitions,
│                                               apply_reputation_event, availability_for_slot, create_club_with_owner
│
├── public/
│   ├── manifest.webmanifest     — PWA
│   └── sw.js                    — service worker (shell cache + web push)
├── scripts/seed.ts              — seed тестовых данных (Demo Arena + 40 ПК + демо-бронь)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── components.json              — shadcn/ui конфиг
├── railway.json                 — build + healthcheck для Railway
├── nixpacks.toml                — Node 20 + pnpm для builder
├── .env.example
└── .gitignore
```

---

## Что уже реализовано (MVP skeleton)

| Модуль | Статус | Где |
|---|---|---|
| БД + RLS | ✅ | `supabase/migrations/` — все таблицы и политики |
| SECURITY DEFINER RPC | ✅ | `create_booking`, `cancel_booking`, `check_in_booking`, `mark_no_show`, `apply_reputation_event`, `run_auto_status_transitions`, `availability_for_slot`, `create_club_with_owner` |
| Auth (Email OTP) | ✅ | `/login`, триггер `handle_new_auth_user` |
| Onboarding клуба | ✅ | `/onboarding/club` |
| Публичная витрина | ✅ | `/c/[slug]` с интерактивной картой, live-availability (RPC polling 30c) |
| Создание брони | ✅ | `/api/bookings` + BottomSheet с inline-OTP |
| Мои брони (игрок) | ✅ | `/my/bookings` |
| Админ-дашборд | ✅ | `/admin` со счётчиками |
| Today-board | ✅ | `/admin/today-board` с Realtime-подпиской + звуком новой брони |
| Все брони (фильтры) | ✅ | `/admin/bookings` |
| Cron auto-no-show | ✅ | `/api/cron/auto-transitions` + RPC |
| PWA | ✅ | manifest + service worker + web push handler |

## Что осталось сделать до полного MVP

- [ ] Редактор карты зала `/admin/map-editor` (drag-n-drop ПК на сетке)
- [ ] Управление зонами/ПК `/admin/stations`, `/admin/zones`
- [ ] Админ-приглашения `/invite/[token]` + `invitations` RPC
- [ ] Email-отправка через Resend (обработчик `notifications_log` → Resend API)
- [ ] Web Push отправка (VAPID + роут POST подписки)
- [ ] i18n (вынесение строк в `locales/ru|kk|en/*.json`)
- [ ] Unit-тесты на overlap / pricing / reputation
- [ ] Integration-тесты на RLS (user A vs user B)
- [ ] E2E флоу Playwright: бронь → check-in → completed

Каждое — отдельная фича через `SPEC_TEMPLATE.md` + skill `implement-feature`. Делается инкрементально.

---

## Лицензия / права

Приватный репозиторий, все права у владельца.
