import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, ok } from "@/lib/api-response";
import { logger } from "@/server/logger";
import { withErrorHandling } from "./route-handler";

const request = new Request("http://localhost/api/test");

describe("withErrorHandling", () => {
  it("passes through the handler response", async () => {
    const handler = withErrorHandling(async () => ok({ pong: true }));
    const res = await handler(request, {});
    expect(await res.json()).toEqual({ success: true, data: { pong: true }, error: null });
  });

  it("turns a thrown AppError into its envelope without logging", async () => {
    // Arrange
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const handler = withErrorHandling(async () => {
      throw new AppError("NOT_FOUND", "Tournament not found");
    });

    // Act
    const res = await handler(request, {});

    // Assert
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("turns a ZodError into a 400", async () => {
    const handler = withErrorHandling(async () => {
      z.object({ name: z.string() }).parse({});
      return ok(null);
    });
    const res = await handler(request, {});
    expect(res.status).toBe(400);
  });

  it("logs unexpected errors and returns a generic 500", async () => {
    // Arrange
    const spy = vi.spyOn(logger, "error").mockImplementation(() => {});
    const boom = new Error("db password is hunter2");
    const handler = withErrorHandling(async () => {
      throw boom;
    });

    // Act
    const res = await handler(request, {});
    const body = await res.json();

    // Assert
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect(spy).toHaveBeenCalledWith(
      "Unhandled route error",
      expect.objectContaining({ error: boom }),
    );
    spy.mockRestore();
  });
});
