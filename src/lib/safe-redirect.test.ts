import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/dashboard", "/t/abc123/admin", "/tournaments/new?step=2"])(
    "keeps the local path %s",
    (path) => {
      expect(safeRedirectPath(path)).toBe(path);
    },
  );

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "",
    null,
    undefined,
  ])("falls back for %s", (path) => {
    expect(safeRedirectPath(path)).toBe("/dashboard");
  });

  it("uses a custom fallback", () => {
    expect(safeRedirectPath("//x", "/")).toBe("/");
  });
});
