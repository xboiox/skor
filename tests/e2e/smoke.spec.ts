import { expect, test } from "@playwright/test";

test("landing page shows the primary call to action", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Padel tournaments, scored live.",
  );
  const cta = page.getByRole("link", { name: "Create tournament" });
  await expect(cta).toBeVisible();

  // Touch target ≥ 48px (docs/UI_GUIDELINES.md §3)
  const box = await cta.boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
});

test("landing page does not scroll horizontally", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("health endpoint reports the database is up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({
    success: true,
    data: { status: "ok", database: "up" },
    error: null,
  });
});
