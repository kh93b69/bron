---
name: payments-rules
description: Правила для интеграций платежей — Kaspi, Freedom, Stripe, подписки и депозиты
globs:
  - "src/app/api/payments/**"
  - "src/server/payments/**"
  - "src/app/api/subscriptions/**"
  - "supabase/functions/**/payment*"
---

# Payments Rules — CyberBook

> ⛔ **Этот rule не активируется в MVP.** Платежи (Kaspi Pay / Freedom / подписки-автосписание) запланированы на v3 (Фаза 4.5 роадмапа — см. `PROJECT_IDEA.md`). Файл хранится готовым, чтобы подключить без задержки при активации этой фазы. В MVP эндпоинты `/api/payments/**`, `/api/subscriptions/**` и директории `src/server/payments/**` — ОТСУТСТВУЮТ. Если видишь их создание — это выход за скоуп MVP, эскалируй.
>
> Ниже — правила к моменту, когда фаза начнётся.

## Обязательные правила (BLOCKER при нарушении)

1. **Подпись webhook валидируется ДО парсинга тела.**
   ```ts
   export async function POST(req: Request) {
     const raw = await req.text();
     const signature = req.headers.get('X-Kaspi-Signature');
     if (!verifyHmac(raw, signature, env.KASPI_WEBHOOK_SECRET)) {
       await logSecurityEvent({ kind: 'webhook.bad_signature', provider: 'kaspi', ip: ... });
       return new Response('unauthorized', { status: 401 });
     }
     const payload = JSON.parse(raw);
     // ...
   }
   ```

2. **Идемпотентность — через `payment_intents.provider_ref UNIQUE`.**
   - Повторный webhook с тем же `provider_ref` в терминальном статусе → 200 no-op
   - Перевод `payment_intents` в статус только через транзакцию с `FOR UPDATE`

3. **Суммы — `integer` в минимальных единицах**:
   - ₸ в UI → тенге как `integer`
   - Провайдер API чаще ждёт тийины (`₸ × 100`) → конвертация ТОЛЬКО на границе, в `payment_intents.amount` — тийины.
   - Никаких `parseFloat`, `Number()` без проверки целочисленности.

4. **Каждая операция пишется в `audit_log`** с полями `amount`, `provider`, `provider_ref`, `actor_id`, `action`.

5. **Возвраты — с retry и fallback**:
   - Попытка 1 → fail → schedule retry 1 мин
   - Попытка 2 → fail → schedule retry 5 мин
   - Попытка 3 → fail → алёрт super-admin, запись в `refund_queue`
   - Никогда не оставлять клиента без возврата «тихо»

6. **Timeout webhook → polling провайдера**:
   - Если `payment_intents.status='pending'` > 15 мин, job `reconcile-payments` опрашивает API провайдера и обновляет статус.

7. **Гейтинг фич — только через `hasFeature(clubId, feature)`.** Никаких ad-hoc проверок `if (club.plan === 'pro')` в разных местах.

> **MVP-2025: единый платный тариф Pro 69 990 ₸/мес (1-й месяц 34 990 ₸).** Все фичи продукта включены в Pro с первого дня. Единственный gate — мульти-локация (требует Network 5+ локаций). Депозиты Kaspi/Freedom — отдельная фаза v3, не часть Pro.

## Поток: депозит при бронировании

```
[Клиент] POST /api/bookings/:id/deposit { provider: 'kaspi' }
  → создаётся payment_intent(status=pending, type=deposit)
  → возврат redirect_url

[Клиент] переходит на страницу провайдера → оплачивает

[Провайдер] POST /api/payments/webhook/kaspi
  → валидация подписи
  → FOR UPDATE payment_intent WHERE provider_ref=?
  → UPDATE payment_intent status=paid
  → UPDATE booking status=confirmed
  → INSERT notifications_log (SMS + push admin)
  → INSERT audit_log

[Cron: auto-complete]
  → при checked_in → await refund:
     - call provider.refund(intent.id, idempotency_key=intent.id)
     - UPDATE payment_intent status=refunded

[Cron: auto-no-show]
  → депозит НЕ возвращается, остаётся как clubs revenue
  → UPDATE payment_intent status=paid (не меняется)
  → UPDATE audit_log action='deposit.forfeited'
```

## Поток: B2B-подписка клуба

```
[Владелец] POST /api/admin/clubs/:id/subscription/checkout { plan: 'pro', billing_period: 'monthly' }
  → создаётся payment_intent(type=subscription)
  → возврат redirect_url

[Webhook оплаты]
  → UPDATE subscriptions SET status='active', current_period_end=+30d
  → включаются Pro-фичи немедленно (hasFeature вернёт true)

[Ежедневный cron: subscription-renew]
  → для subscriptions с current_period_end < now() + 3d:
     - попытка автосписания (через сохранённый метод платежа)
     - если успех: продление периода
     - если fail: status='past_due', уведомление владельцу

[Downgrade / cancel]
  → cancel_at_period_end=true
  → в конце периода: subscription.status='cancelled', фичи Pro/Network отключаются
```

## Конвенции именования

- Env: `KASPI_MERCHANT_ID`, `KASPI_SECRET_KEY`, `KASPI_WEBHOOK_SECRET`, `FREEDOM_*`, `STRIPE_*`
- Пути: `/api/payments/webhook/<provider>`, `/api/payments/:id`, `/api/bookings/:id/deposit`
- Коды ошибок: `PAYMENT_PROVIDER_ERROR`, `PAYMENT_TIMEOUT`, `SUBSCRIPTION_NOT_ACTIVE`, `FEATURE_NOT_IN_PLAN`

## Тест-план перед выходом в прод

- [ ] Happy path depozит: create → paid → booking confirmed → check-in → refunded
- [ ] No-show path: create → paid → booking.no_show → deposit forfeited
- [ ] Повтор webhook с тем же provider_ref → 200, нет двойного списания
- [ ] Webhook с неверной подписью → 401, security log
- [ ] Таймаут webhook → reconcile job подхватывает
- [ ] Возврат не прошёл технически → retry → алёрт после 3 попыток
- [ ] Downgrade Pro→Free: промо/блэклисты перестают применяться
- [ ] Feature-гейт: без active subscription попытка create promotion → `FEATURE_NOT_IN_PLAN`
- [ ] Audit log содержит записи каждой платёжной операции

## Запреты

- ❌ Обрабатывать webhook до валидации подписи
- ❌ `float` для денег
- ❌ Хардкод merchant ID, API-ключей
- ❌ Писать в `payment_intents` из клиента
- ❌ Выдавать фичи Pro без active subscription
- ❌ Возвращать клиенту error с деталями от провайдера (security: leak merchant config) — только нормализованные коды
- ❌ Забыть idempotency на операциях с деньгами
