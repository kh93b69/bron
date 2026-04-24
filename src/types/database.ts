/**
 * Плейсхолдер. Реальные типы генерируются Supabase CLI:
 *   pnpm db:types
 *
 * Пока БД ещё не привязана локально, используем максимально открытый тип,
 * чтобы supabase-js не ругался на дженерики таблиц/функций. После генерации
 * реальной схемы этот файл будет полностью перезаписан.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
