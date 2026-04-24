---
name: api-rules
description: Правила для серверной логики — валидация, формат ответов, rate-limiting, audit, транзакции
globs:
  - "src/app/api/**/*.ts"
  - "src/server/**/*.ts"
  - "supabase/functions/**/*.ts"
---

# API Rules — CyberBook

## Обязательные правила

1. **Zod/yup/valibot на каждом input.** Невалидный вход → `400 VALIDATION_ERROR` с полем `details` (массив ошибок по полям).

2. **Единый формат ответа**:
   ```ts
   // success
   { data: <payload> }
   // или прямой payload для GET endpoint, допустимо оба варианта — выбрать один на проект и следовать
   
   // error
   { error: { code: 'BOOKING_SLOT_OCCUPIED', message: 'Slot is taken', details?: {...} } }
   ```
   Коды — строковые константы из централизованного файла `src/server/errors.ts`.

3. **HTTP-коды**:
   - `200` — успешный GET / idempotent mutation
   - `201` — создан ресурс
   - `204` — успешный DELETE / действие без тела
   - `400` — валидация
   - `401` — не аутентифицирован
   - `403` — не авторизован (включая баны, чёрный список)
   - `404` — не найден
   - `409` — конфликт (overlap, дубликат)
   - `410` — устарел (OTP expired)
   - `422` — бизнес-правило нарушено (когда 400 не подходит)
   - `429` — rate limit

4. **Rate-limits — на каждом публичном mutation-эндпоинте.** Идентификация: user_id (если аутентифицирован) + IP. Лимиты:
   - `/auth/otp/request`: 3 / 15 мин / номер+IP
   - `/auth/otp/verify`: 5 попыток на код
   - `/api/bookings` (POST): 20 / час / user
   - Внутренний бизнес-лимит: не более 10 активных будущих броней / user

5. **Транзакции для мульти-таблицных изменений.** Особенно: создание брони (`bookings` + `booking_stations` + `notifications_log`), платежи, отмена.

6. **`SELECT ... FOR UPDATE` при изменении `bookings`.** Никогда «check-then-write» без блокировки.

7. **`audit_log` на все mutation в критических таблицах**: `bookings`, `club_members`, `blacklists`, `subscriptions`, `payment_intents`, `stations.status`, `club_maps`.

8. **Никаких секретов в коде.** Все ключи — через env (`process.env.KASPI_SECRET`, и т.д.). Если стек = Next.js: только через `env.ts`-типизированный слой.

9. **Логирование**: structured (JSON), с `request_id`, `user_id`, `club_id`, путь, статус, длительность. Уровни: `debug`, `info`, `warn`, `error`.

10. **CSRF** — на mutation-эндпоинтах, вызываемых из браузера (cookie-based auth).

## Шаблон эндпоинта

```ts
// POST /api/bookings — создание брони
const bookingInput = z.object({
  club_id: z.string().uuid(),
  station_ids: z.array(z.string().uuid()).min(1).max(10),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  // 1. Auth
  const user = await requireUser(req);
  // 2. Parse + validate
  const body = bookingInput.parse(await req.json());
  // 3. Rate-limit
  await checkRateLimit('bookings:create', user.id);
  // 4. Business
  try {
    const booking = await createBookingTx({ userId: user.id, ...body });
    await audit({ actor: user.id, action: 'booking.create', entityId: booking.id, ... });
    return json({ data: booking }, 201);
  } catch (e) {
    if (e instanceof BookingOverlapError)   return errJson('BOOKING_SLOT_OCCUPIED', 409);
    if (e instanceof UserBannedError)       return errJson('USER_BANNED', 403, { until: e.until });
    if (e instanceof ClubClosedError)       return errJson('CLUB_CLOSED', 422);
    throw e;
  }
}
```

## Real-time / подписки

- Каналы именуются `club:<club_id>:bookings`, `user:<user_id>:notifications`.
- Авторизация каналов: RLS на таблице + проверка доступа при SUBSCRIBE.
- Не рассылать весь payload — только `{event, booking_id, at}`, клиент перезапрашивает детали если нужно.

## Cron / background jobs

Регистрация: `supabase/functions/cron-*.ts` или аналог. Обязательные в MVP:
- `auto-no-show` — каждые 15 мин
- `auto-complete` — каждые 15 мин
- `send-reminders` — каждые 5 мин (T–30 минут до брони)
- `process-notifications` — каждые 30 сек (очередь)
- `expire-pending-payments` — каждые 5 мин

Каждая job: idempotent, с таймаутом, с логированием выполнения в `job_runs` (id, started_at, finished_at, items_processed, error).

## Запреты

- ❌ Бросать сырые БД-ошибки наружу (`Error: duplicate key ...` → 500)
- ❌ Возвращать разный формат ошибок на разных эндпоинтах
- ❌ Использовать `service_role` в обработчиках пользовательских запросов
- ❌ `SELECT *` на таблицах с PII (users) — явный список колонок
- ❌ `console.log` вместо structured logger
- ❌ Синхронная отправка SMS/Push из обработчика — только через `notifications_log`
