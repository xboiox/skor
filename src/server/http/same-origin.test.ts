import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api-response";
import { assertSameOrigin, assertSameOriginJson } from "./same-origin";

const APP_URL = "http://localhost:3000";

function request(headers: Record<string, string>) {
  return new Request(`${APP_URL}/api/tournaments`, { method: "POST", headers });
}

function codeOf(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    return err instanceof AppError ? err.code : "UNEXPECTED";
  }
}

describe("assertSameOriginJson", () => {
  it("accepts a JSON request from the app's own origin", () => {
    const req = request({ origin: APP_URL, "content-type": "application/json; charset=utf-8" });
    expect(codeOf(() => assertSameOriginJson(req, APP_URL))).toBeNull();
  });

  it("accepts a same-origin fetch that omits Origin but sends Sec-Fetch-Site", () => {
    const req = request({ "sec-fetch-site": "same-origin", "content-type": "application/json" });
    expect(codeOf(() => assertSameOriginJson(req, APP_URL))).toBeNull();
  });

  it("rejects another origin", () => {
    const req = request({ origin: "https://evil.example", "content-type": "application/json" });
    expect(codeOf(() => assertSameOriginJson(req, APP_URL))).toBe("FORBIDDEN");
  });

  it("rejects a cross-site request without Origin", () => {
    const req = request({ "sec-fetch-site": "cross-site", "content-type": "application/json" });
    expect(codeOf(() => assertSameOriginJson(req, APP_URL))).toBe("FORBIDDEN");
  });

  it("rejects requests that are not JSON (e.g. a plain HTML form post)", () => {
    const req = request({ origin: APP_URL, "content-type": "application/x-www-form-urlencoded" });
    expect(codeOf(() => assertSameOriginJson(req, APP_URL))).toBe("VALIDATION_ERROR");
  });
});

describe("assertSameOrigin", () => {
  it("does not require a JSON body", () => {
    const req = new Request(`${APP_URL}/api/x`, { method: "DELETE", headers: { origin: APP_URL } });
    expect(codeOf(() => assertSameOrigin(req, APP_URL))).toBeNull();
  });

  it("still rejects other origins", () => {
    const req = new Request(`${APP_URL}/api/x`, {
      method: "DELETE",
      headers: { origin: "https://evil.example" },
    });
    expect(codeOf(() => assertSameOrigin(req, APP_URL))).toBe("FORBIDDEN");
  });
});
