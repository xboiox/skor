import type { ApiError, ApiResponse, ErrorCode } from "./api-response";

export type ClientErrorCode = ErrorCode | "NETWORK_ERROR";
export type ClientResponse<T> =
  | Extract<ApiResponse<T>, { success: true }>
  | { success: false; data: null; error: Omit<ApiError, "code"> & { code: ClientErrorCode } };

type RequestOptions = { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

function failure(code: ClientErrorCode, message: string): ClientResponse<never> {
  return { success: false, data: null, error: { code, message } };
}

/** Same-origin JSON call to our API. Never throws: offline and broken responses become errors. */
export async function apiRequest<T>(
  url: string,
  options: RequestOptions,
): Promise<ClientResponse<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: { "content-type": "application/json" },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    return failure("NETWORK_ERROR", "No connection. Check your signal and try again.");
  }
  try {
    return (await response.json()) as ClientResponse<T>;
  } catch {
    return failure("INTERNAL_ERROR", "Something went wrong. Please try again.");
  }
}
