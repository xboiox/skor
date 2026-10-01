import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError, fail, ok, toAppError } from "./api-response";

describe("ok", () => {
  it("wraps data in a success envelope with status 200", async () => {
    // Arrange
    const data = { id: "t1" };

    // Act
    const res = ok(data);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data, error: null });
  });

  it("accepts a custom status", () => {
    expect(ok({}, 201).status).toBe(201);
  });
});

describe("fail", () => {
  it("maps the error code to its HTTP status", async () => {
    // Arrange
    const error = new AppError("VERSION_CONFLICT", "Match was updated", { version: 3 });

    // Act
    const res = fail(error);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      success: false,
      data: null,
      error: { code: "VERSION_CONFLICT", message: "Match was updated", details: { version: 3 } },
    });
  });

  it("omits details when none are given", async () => {
    const body = await fail(new AppError("NOT_FOUND", "Tournament not found")).json();
    expect(body.error).toEqual({ code: "NOT_FOUND", message: "Tournament not found" });
  });
});

describe("toAppError", () => {
  it("returns AppError instances unchanged", () => {
    const error = new AppError("FORBIDDEN", "Host only");
    expect(toAppError(error)).toBe(error);
  });

  it("converts a ZodError into VALIDATION_ERROR with field paths", () => {
    // Arrange
    const result = z.object({ courts: z.number().min(1) }).safeParse({ courts: 0 });
    if (result.success) throw new Error("expected parse failure");

    // Act
    const error = toAppError(result.error);

    // Assert
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.status).toBe(400);
    expect(error.details).toEqual([{ path: "courts", message: expect.any(String) }]);
  });

  it("hides unknown errors behind a generic INTERNAL_ERROR message", () => {
    const error = toAppError(new Error("connection refused at 10.0.0.5"));
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(error.message).toBe("Something went wrong. Please try again.");
    expect(error.details).toBeUndefined();
  });
});
