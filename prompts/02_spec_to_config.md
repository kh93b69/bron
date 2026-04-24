# Промпт-инструкция 2: Спецификация → Конфигурация

> Генерирует один большой «финальный промпт», который создаёт/пересоздаёт пакет конфигурации (`CLAUDE.md`, `.claude/agents/*`, `.claude/rules/*`, `.claude/skills/*`, `SPEC_TEMPLATE.md`) из `SPEC.md`. Нужен после фиксации стека или после значительных изменений в спеке.

---

## Промпт (копируй в чат Claude с загруженными PROJECT_IDEA.md, SPEC.md, CONFIG_GENERATOR.md)

```
Ты — главный инженер-архитектор DevEx. Твоя задача — превратить продуктовую спецификацию CyberBook (SPEC.md) в набор файлов конфигурации для Claude Code. Работай по инструкции из CONFIG_GENERATOR.md.

Входные документы:
- PROJECT_IDEA.md — контекст продукта
- SPEC.md — техническая спецификация (17 модулей)
- CONFIG_GENERATOR.md — правила генерации

Переменная стека:
{{STACK}} = "<заполнить пользователем. Рекомендуемый дефолт: Next.js 15 App Router + Supabase (Postgres + Auth + Realtime + Edge Functions) + TypeScript + Tailwind + shadcn/ui + React Query + Zod + Lucide>"

Если {{STACK}} НЕ передан — используй нейтральные формулировки («серверная логика», «миграции», «фреймворк») и явно помести раздел «Стек: TBD» в CLAUDE.md.

Задача:
Сгенерируй ОДИН финальный промпт, который при вставке в Claude Code создаёт всю структуру конфигурации в корне репозитория.

Состав вывода (один markdown-блок):

1. Команды mkdir для создания директорий
2. Содержимое КАЖДОГО файла целиком:
   - CLAUDE.md (≤120 строк, структура из CONFIG_GENERATOR.md)
   - SPEC_TEMPLATE.md
   - .claude/agents/database-architect.md
   - .claude/agents/backend-engineer.md
   - .claude/agents/frontend-developer.md
   - .claude/agents/qa-reviewer.md (tools: Read, Bash, Glob, Grep — БЕЗ Write/Edit)
   - .claude/agents/payments-specialist.md
   - .claude/rules/db-rules.md (globs: migrations, server)
   - .claude/rules/api-rules.md
   - .claude/rules/ui-rules.md
   - .claude/rules/security-rules.md
   - .claude/rules/payments-rules.md
   - .claude/skills/implement-feature.md
   - .claude/skills/create-migration.md
3. Команды MCP: context7 (обязательно), supabase (если стек = Supabase), github (опционально)
4. Чеклист пост-проверки

Правила:
- CLAUDE.md ≤ 120 строк, содержит: обзор / стек / архитектура / конвенции / роли / правила Claude / команды / где искать детали
- Каждый субагент: YAML-header (name, description, tools, model) + 5 секций (Роль / Принципы / Паттерны / Чеклист / Интеграция)
- Модели: opus (database, backend, payments), sonnet (frontend, qa-reviewer)
- qa-reviewer НИКОГДА не имеет Write/Edit
- Rules: YAML frontmatter с `globs` + список правил с конкретикой (без абстракций)
- Skills: пошаговые workflow, ссылки на субагентов

Классификация проекта CyberBook:
- Продакшн AI-агенты для пользователей? → Нет (booking, не AI-чат) → ai-agent-architect НЕ нужен
- Платежи? → Да (Kaspi, Freedom, Stripe) → payments-specialist ОБЯЗАТЕЛЕН
- Real-time? → Да (live-карта, уведомления админу)
- PWA? → Да (mobile-first витрина)
- SMS? → Да (OTP, напоминания)

→ Субагенты: 5 (database-architect, backend-engineer, frontend-developer, qa-reviewer, payments-specialist)
→ Rules: 5 (db, api, ui, security, payments)
→ Skills: 2 (implement-feature, create-migration)

Workflow:
1. Прочитай PROJECT_IDEA.md и SPEC.md.
2. Определи стек из {{STACK}}.
3. Сгенерируй содержимое каждого файла.
4. Проверь чеклист CONFIG_GENERATOR.md.
5. Выведи ОДИН длинный промпт — без создания файлов самостоятельно, это сделает Claude Code, когда пользователь вставит промпт.

ГЛАВНОЕ ПРАВИЛО:
Промпт copy-paste ready. Никаких «…», «аналогично», «заполнить». Пользователь вставляет в Claude Code, нажимает Enter, и через 1 минуту у него готовая структура в корне.

Если что-то в SPEC.md противоречит CONFIG_GENERATOR.md — приоритет у CONFIG_GENERATOR.md (именно он описывает, КАК генерировать).
```

## Когда использовать

- При первом запуске проекта (после фиксации стека)
- После обновления `SPEC.md` с новыми модулями
- После смены стека (например, Supabase → Neon/Drizzle)
- При апгрейде субагентов (новые паттерны, новые правила)

## Критерии качества вывода

- Финальный промпт — один цельный документ, готовый к вставке
- Все файлы имеют полное содержимое (не ссылки, не «…»)
- CLAUDE.md ≤ 120 строк
- qa-reviewer без Write/Edit
- Rules с корректными `globs`
- MCP-команды исполняемы в терминале
