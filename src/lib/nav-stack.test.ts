import { describe, expect, it } from "vitest";
import { canGoBack, MAX_DEPTH, nextStack, parseStack } from "./nav-stack";

describe("nextStack", () => {
  it("starts with the first page", () => {
    expect(nextStack([], "/login")).toEqual(["/login"]);
  });

  it("pushes a new page", () => {
    expect(nextStack(["/"], "/login")).toEqual(["/", "/login"]);
  });

  it("pops when the user goes back to the previous page", () => {
    expect(nextStack(["/", "/login", "/register"], "/login")).toEqual(["/", "/login"]);
  });

  it("ignores a reload of the same page", () => {
    const stack = ["/", "/login"];
    expect(nextStack(stack, "/login")).toBe(stack);
  });

  it("stays bounded", () => {
    const long = Array.from({ length: MAX_DEPTH }, (_, i) => `/p${i}`);
    const next = nextStack(long, "/new");
    expect(next).toHaveLength(MAX_DEPTH);
    expect(next.at(-1)).toBe("/new");
  });
});

describe("canGoBack", () => {
  it("is false for a page opened directly (e.g. from WhatsApp)", () => {
    expect(canGoBack(["/login"])).toBe(false);
    expect(canGoBack([])).toBe(false);
  });

  it("is true after moving within the app", () => {
    expect(canGoBack(["/", "/login"])).toBe(true);
  });
});

describe("parseStack", () => {
  it("reads a stored stack and rejects anything else", () => {
    expect(parseStack('["/","/login"]')).toEqual(["/", "/login"]);
    expect(parseStack(null)).toEqual([]);
    expect(parseStack("not json")).toEqual([]);
    expect(parseStack('[1,"/x"]')).toEqual([]);
    expect(parseStack('["https://evil.example"]')).toEqual([]);
  });
});
