import { ZodError } from "zod";

export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VERSION_CONFLICT: 409,
  INVALID_STATE: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export type ApiError = { code: ErrorCode; message: string; details?: unknown };

export type ApiResponse<T> =
  { success: true; data: T; error: null } | { success: false; data: null; error: ApiError };

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

export function ok<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data, error: null };
  return Response.json(body, { status });
}

export function fail(error: AppError): Response {
  const apiError: ApiError =
    error.details === undefined
      ? { code: error.code, message: error.message }
      : { code: error.code, message: error.message, details: error.details };
  const body: ApiResponse<never> = { success: false, data: null, error: apiError };
  return Response.json(body, { status: error.status });
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return new AppError("VALIDATION_ERROR", "Invalid input", details);
  }
  return new AppError("INTERNAL_ERROR", GENERIC_ERROR_MESSAGE);
}
