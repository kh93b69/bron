/**
 * Централизованные коды ошибок API. Клиент ловит по `code`, локализует сам.
 * Source of truth для формата { error: { code, message, details? } }.
 */

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "BOOKING_SLOT_OCCUPIED"
  | "INVALID_SLOT"
  | "INVALID_STATIONS"
  | "USER_BANNED"
  | "CANCEL_TOO_LATE"
  | "INVALID_STATE"
  | "CLUB_CLOSED"
  | "DUPLICATE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const AppErrors = {
  unauthorized: () => new AppError("UNAUTHORIZED", 401, "Требуется вход"),
  forbidden: () => new AppError("FORBIDDEN", 403, "Нет доступа"),
  notFound: (what = "Объект") => new AppError("NOT_FOUND", 404, `${what} не найден`),
  validation: (details: unknown) => new AppError("VALIDATION_ERROR", 400, "Некорректные данные", details),
  slotOccupied: () => new AppError("BOOKING_SLOT_OCCUPIED", 409, "Выбранное время уже занято"),
  invalidSlot: (msg = "Некорректное время") => new AppError("INVALID_SLOT", 400, msg),
  invalidStations: () => new AppError("INVALID_STATIONS", 400, "Неверные станции"),
  banned: (until?: string) => new AppError("USER_BANNED", 403, "Аккаунт заблокирован", { until }),
  rateLimited: () => new AppError("RATE_LIMITED", 429, "Превышен лимит запросов"),
  cancelTooLate: () => new AppError("CANCEL_TOO_LATE", 422, "Отмена возможна не позднее чем за 2 часа"),
  invalidState: (state: string) =>
    new AppError("INVALID_STATE", 422, `Недопустимое состояние: ${state}`),
  internal: () => new AppError("INTERNAL_ERROR", 500, "Внутренняя ошибка"),
};

/**
 * Мэппинг PostgreSQL/PostgREST ошибок на AppError.
 * RAISE EXCEPTION 'CODE' ... в SECURITY DEFINER функциях → возвращается в e.message.
 */
export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("BOOKING_SLOT_OCCUPIED")) return AppErrors.slotOccupied();
  if (msg.includes("INVALID_SLOT")) return AppErrors.invalidSlot(msg);
  if (msg.includes("INVALID_STATIONS")) return AppErrors.invalidStations();
  if (msg.includes("USER_BANNED")) return AppErrors.banned();
  if (msg.includes("RATE_LIMITED")) return AppErrors.rateLimited();
  if (msg.includes("CANCEL_TOO_LATE")) return AppErrors.cancelTooLate();
  if (msg.startsWith("INVALID_STATE")) return AppErrors.invalidState(msg.split("INVALID_STATE")[1] ?? "");
  if (msg === "NOT_FOUND") return AppErrors.notFound();
  if (msg === "FORBIDDEN" || (e as { code?: string })?.code === "42501") return AppErrors.forbidden();
  console.error("[toAppError] unknown", e);
  return AppErrors.internal();
}

export function errorToJson(err: AppError) {
  return {
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
    },
  };
}
