---
name: ui-rules
description: Правила для UI — mobile-first, состояния, i18n, PWA, производительность
globs:
  - "src/app/**/*.tsx"
  - "src/app/**/*.jsx"
  - "src/components/**/*.tsx"
  - "src/components/**/*.jsx"
  - "public/manifest.json"
  - "public/sw.js"
---

# UI Rules — CyberBook

## Обязательные правила

1. **Mobile-first**: начальная вёрстка на 375px, брейкпоинты `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`. Каждый экран проверяется на 375px перед коммитом.

2. **Четыре состояния для каждого списка/экрана с данными**:
   - `loading` — skeleton (не spinner в центре), по форме похожий на будущий контент
   - `empty` — иллюстрация + текст + CTA
   - `error` — сообщение + кнопка «Повторить»
   - `success` — основной контент
   Отсутствие одного из состояний = MAJOR в review.

3. **i18n — 100% покрытие**. Все строки через `t('namespace.key')`. Языки: `ru` (default), `kk`, `en`. Ключи — в `locales/<lang>/<namespace>.json`. Линт: нет кириллицы в `.tsx`/`.ts` кроме тестов и комментариев.

4. **shadcn/ui first** (при наличии в стеке). Собственные компоненты — только когда shadcn не покрывает. Обёртки вокруг shadcn — в `src/components/ui-ext/`.

5. **Формы**:
   - React Hook Form + zod resolver (если стек React)
   - Error-message — inline под полем
   - `disabled` во время submit, loader внутри кнопки
   - Поле телефона — маска `+7 (___) ___-__-__` (KZ/RU)
   - OTP-поле — `inputmode="numeric"`, 6 ячеек, автофокус

6. **Перформанс-бюджет**:
   - Публичная витрина: bundle ≤150KB gz, LCP ≤2s на 4G
   - Админка: bundle ≤400KB gz, TTI ≤3s
   - Иконки: `import { Icon } from 'lucide-react'`, никогда `import * as`
   - Картинки: `next/image` (или аналог), `srcset`, `loading="lazy"` вне viewport

7. **Accessibility**:
   - `aria-label` / `aria-labelledby` на кнопках без текста
   - `role` на кастомных интерактивных элементах
   - Focus-ring виден (не `outline: none` без замены)
   - Контраст AA (4.5:1 для текста)
   - Навигация по Tab корректна в админке

8. **Optimistic UI** — для check-in, no-show, отмены, промо-тогла. Откат при ошибке с тостом.

9. **Real-time в админке** — подписка на канал клуба, обновление списка без `location.reload`. Новая бронь → подсветка + звук (user triggered first, потом autoplay policy).

10. **PWA-манифест + service worker** в `public/`. Кешируем: shell, CSS, шрифты, иконки. Не кешируем: API-ответы (или сетевая стратегия NetworkFirst с коротким timeout).

## Паттерны компонентов

### Состояния списка
```tsx
function BookingsList({ query }) {
  const { data, isLoading, error, refetch } = useBookings(query);

  if (isLoading) return <BookingsSkeleton />;
  if (error)     return <ErrorState onRetry={refetch} message={t('common.error.load')} />;
  if (!data?.length) return <EmptyState
    icon={<Calendar />}
    title={t('bookings.empty.title')}
    description={t('bookings.empty.desc')}
    cta={<Button onClick={goBook}>{t('bookings.empty.cta')}</Button>}
  />;
  return <ul>{data.map(b => <BookingRow key={b.id} booking={b} />)}</ul>;
}
```

### Bottom-sheet бронирования (структура)
```
<Sheet open={isOpen} onOpenChange={setOpen}>
  <SheetContent side="bottom" className="max-h-[90vh]">
    <Step1Summary station={station} slot={slot} price={price} />
    <Step2Phone />
    <Step3OTP />
    <Step4Success qrCode={...} />
  </SheetContent>
</Sheet>
```

### Today-board (админка на планшете)
```tsx
<section aria-label={t('admin.board.title')} className="h-screen flex flex-col">
  <BoardHeader counters={...} />
  <BoardTimeline bookings={liveBookings} highlightedId={lastNewId} />
  {/* автоscroll к "сейчас" */}
  {/* звук на новом booking.created */}
</section>
```

## Запреты

- ❌ Hardcoded строки в JSX (`<h1>Главная</h1>` — только `<h1>{t('home.title')}</h1>`)
- ❌ `any` в пропсах компонентов
- ❌ `useEffect` для fetch — только через React Query / SWR / Server Components
- ❌ Inline-style с магическими числами — Tailwind-токены или CSS variables
- ❌ `alert()`/`confirm()`/`prompt()` — только через `<Dialog>` и `<AlertDialog>`
- ❌ Spinner-only loader на списках (только skeleton)
- ❌ Бесконечный спиннер без timeout
- ❌ `position: fixed` z-index > 100 без комментария-обоснования
- ❌ Импорт иконок через `* as icons`
