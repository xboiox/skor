import { AppError } from "@/lib/api-response";

/**
 * CSRF defence for cookie-authenticated mutations: the request must come from our own origin
 * and carry JSON (an HTML form on another site cannot send application/json without CORS).
 */
export function assertSameOriginJson(request: Request, appUrl: string): void {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError("VALIDATION_ERROR", "Send the request as JSON.");
  }
  assertSameOrigin(request, appUrl);
}

/** Same-origin check alone, for body-less mutations such as DELETE. */
export function assertSameOrigin(request: Request, appUrl: string): void {
  const origin = request.headers.get("origin");
  const isSameOrigin = origin
    ? origin === new URL(appUrl).origin
    : request.headers.get("sec-fetch-site") === "same-origin";
  if (!isSameOrigin) throw new AppError("FORBIDDEN", "Cross-site requests are not allowed.");
}
