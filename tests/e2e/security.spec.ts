import { expect, test } from "@playwright/test";

test("pages and APIs send baseline security headers", async ({ request }) => {
  for (const path of ["/", "/api/health", "/login"]) {
    const res = await request.get(path);
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  }
});

test("creating tournaments from one address is rate limited", async ({ request, baseURL }) => {
  const ip = `10.250.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const create = () =>
    request.post("/api/tournaments", {
      headers: { origin: baseURL!, "x-forwarded-for": ip },
      data: {
        name: "Spam",
        date: "2026-10-03",
        matchType: "mexicano",
        courts: 1,
        scoring: { type: "rally", totalPoints: 16 },
        players: ["A", "B", "C", "D"],
      },
    });
  const statuses: number[] = [];
  for (let i = 0; i < 11; i += 1) statuses.push((await create()).status());
  expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);

  const blocked = await create();
  expect(blocked.status()).toBe(429);
  expect(Number(blocked.headers()["retry-after"])).toBeGreaterThan(0);
  expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
});

test("API errors never leak internals", async ({ request, baseURL }) => {
  const res = await request.post("/api/tournaments", {
    headers: { origin: baseURL!, "content-type": "application/json" },
    data: "{broken",
  });
  expect(res.status()).toBe(400);
  const text = await res.text();
  expect(text).not.toMatch(/stack|at .+\.ts|postgres|drizzle/i);
});
