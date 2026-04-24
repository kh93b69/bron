---
name: security-rules
description: Кросс-стековые правила безопасности — секреты, RLS, rate-limits, санитизация, CSRF, audit
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.sql"
  - ".env.example"
  - "**/*.json"
---

# Security Rules — CyberBook

## Классы угроз и митигация

### 1. Утечка данных между клубами (мульти-тенант)
- **Источник**: клуб A видит брони/клиентов клуба B.
- **Митигация**:
  - RLS на каждой таблице с `club_id`
  - Политика включает проверку `club_members.user_id = auth.uid() AND club_members.club_id = <row>.club_id`
  - Никаких `service_role` в клиентском коде
  - API-эндпоинт, принимающий `clubId`, проверяет `auth.uid() ∈ club_members(clubId)`

### 2. Двойные списания / двойные брони
- **Источник**: race condition, повтор webhook.
- **Митигация**:
  - Транзакции с `SELECT FOR UPDATE`
  - `provider_ref` UNIQUE для webhook'ов
  - Idempotency-ключ на клиентских мутациях (`Idempotency-Key` header)

### 3. Подделка платежа / webhook
- **Источник**: атакующий шлёт фальшивый webhook «paid».
- **Митигация**:
  - HMAC-подпись на raw body
  - Валидация до любых side-effects
  - Белый список IP провайдера (опционально)
  - Логирование всех попыток в `security_log`

### 4. XSS через user-generated content
- **Источник**: описание клуба, notes в брони, имена.
- **Митигация**:
  - При рендере — строгая экранизация (React делает по умолчанию, но `dangerouslySetInnerHTML` — ЗАПРЕЩЁН)
  - При сохранении — sanitize через `DOMPurify`-подобное для HTML-полей (описание клуба с форматированием)
  - `jsonb`-поля (`map.layout`, `station.specs`) — валидируются по схеме

### 5. SQL-injection
- **Митигация**: только параметризованные запросы / ORM. Конкатенация SQL-строк с пользовательскими данными = BLOCKER.

### 6. Bruteforce OTP
- **Митигация**:
  - 3 запроса OTP на номер / 15 мин
  - 5 попыток ввода на один код → код инвалидируется
  - Экспоненциальный backoff при повторных request после блокировки

### 7. Phishing под видом клуба
- **Митигация**:
  - Публичные URL клубов — только через зафиксированный домен
  - White-label домены (Network) — валидация владения через DNS TXT

### 8. Утечка через логи
- **Митигация**:
  - НЕ логировать: пароли, OTP-коды (plain), токены сессий, номера карт, CVV, phone в полном виде в production (маска: `+7701***4567`)
  - Structured logs с белым списком полей

## Обязательные настройки

- `.env` в `.gitignore`. Коммит `.env.example` со списком переменных без значений.
- Secrets в production — только через секрет-менеджер хостинга (Vercel, Supabase Vault, AWS SSM).
- HTTPS везде. `Strict-Transport-Security: max-age=31536000`.
- Content Security Policy — запрет inline-скриптов, белый список доменов.
- `X-Frame-Options: DENY` (защита от clickjacking).
- CSRF-токены на cookie-based auth mutation.
- 2FA (TOTP) обязательна для `super_admin`.

## Rate-limits (минимум)

| Endpoint | Limit | Key |
|---|---|---|
| `POST /auth/otp/request` | 3 / 15 мин | phone + ip |
| `POST /auth/otp/verify` | 5 попыток | code |
| `POST /auth/email/login` | 5 / 15 мин | email + ip |
| `POST /api/bookings` | 20 / час | user_id |
| `GET /api/public/*` | 60 / мин | ip |
| Любой webhook | 30 / сек | ip провайдера |

Реализация: токен-бакет (Redis/KV/Upstash/аналог). Возврат `429` с `Retry-After` header.

## Audit Log — обязательные события

- `auth.login`, `auth.otp_verify` (успех и провал)
- `booking.create`, `booking.cancel`, `booking.check_in`, `booking.no_show`
- `club_member.add`, `club_member.remove`
- `blacklist.add`, `blacklist.remove`
- `map.update`
- `subscription.change_plan`
- `payment.deposit.created`, `payment.deposit.refunded`
- `super.impersonate_start`, `super.impersonate_end`

Поля: `actor_id, club_id, action, entity_type, entity_id, payload (безопасный), ip, user_agent, created_at`.

## Запреты (BLOCKER)

- ❌ `process.env.SOMETHING` на клиенте без `NEXT_PUBLIC_` / аналогичного префикса
- ❌ Секреты в `git` (включая историю). Утёкший секрет — ротировать немедленно
- ❌ `dangerouslySetInnerHTML` без обоснования и sanitize
- ❌ `eval`, `Function(...)`
- ❌ Передача сырого SQL в БД с конкатенацией пользовательских данных
- ❌ Логирование номера телефона / email в plain
- ❌ Отключение RLS в проде («временно посмотреть»)
- ❌ Коммит с `console.log(accessToken)` / `console.log(user)`
- ❌ `service_role` в клиентском коде / в браузере

## Проверка перед деплоем

- [ ] `.env` не в git, `.env.example` актуален
- [ ] Все публичные эндпоинты имеют rate-limit
- [ ] HTTPS + HSTS
- [ ] CSP настроен и работает (нет consoleerror на всех страницах)
- [ ] RLS прошла тест: user X не видит данных user Y
- [ ] 2FA включена для super_admin
- [ ] Webhook'и платежей проверяют подпись
- [ ] Audit log пишется на критичных действиях
- [ ] Логи не содержат PII в открытом виде
