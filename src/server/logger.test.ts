import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

function lastJsonLine(spy: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const call = spy.mock.calls.at(-1);
  return JSON.parse(String(call?.[0]));
}

describe("logger", () => {
  it("writes info as a single JSON line to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logger.info("tournament created", { tournamentId: "t1" });

    expect(lastJsonLine(spy)).toMatchObject({
      level: "info",
      message: "tournament created",
      tournamentId: "t1",
      time: expect.any(String),
    });
  });

  it("writes debug to stdout", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.debug("tick");
    expect(lastJsonLine(spy)).toMatchObject({ level: "debug", message: "tick" });
  });

  it("writes warn and error to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.warn("slow query");
    expect(lastJsonLine(spy)).toMatchObject({ level: "warn" });

    logger.error("failed");
    expect(lastJsonLine(spy)).toMatchObject({ level: "error" });
  });

  it("serializes Error values with name, message and stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("boom", { error: new TypeError("bad input") });

    expect(lastJsonLine(spy).error).toMatchObject({
      name: "TypeError",
      message: "bad input",
      stack: expect.stringContaining("TypeError"),
    });
  });
});
