import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiRequest", () => {
  it("sends JSON and returns the envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ success: true, data: { id: 1 }, error: null }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiRequest<{ id: number }>("/api/x", { method: "POST", body: { a: 1 } });

    expect(result).toEqual({ success: true, data: { id: 1 }, error: null });
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: '{"a":1}',
    });
  });

  it("passes API errors through", async () => {
    const body = { success: false, data: null, error: { code: "FORBIDDEN", message: "Host only" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body, { status: 403 })));
    expect(await apiRequest("/api/x", { method: "DELETE" })).toEqual(body);
  });

  it("turns a network failure into a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const result = await apiRequest("/api/x", { method: "POST", body: {} });
    expect(result).toMatchObject({ success: false, error: { code: "NETWORK_ERROR" } });
  });

  it("handles a non-JSON response (e.g. a proxy error page)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 })),
    );
    const result = await apiRequest("/api/x", { method: "POST", body: {} });
    expect(result).toMatchObject({ success: false, error: { code: "INTERNAL_ERROR" } });
  });
});
