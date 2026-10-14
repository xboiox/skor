import { expect, test } from "@playwright/test";

// Next.js shows loading.tsx instantly only once it is prefetched. A production build prefetches as
// soon as the link is on screen; the dev server prefetches lazily, so this check would be flaky there.
// Run against `next start`: E2E_PRODUCTION=1 E2E_BASE_URL=http://localhost:3100 npx playwright test loading
test("a skeleton shows right away while the next page renders", async ({ page }) => {
  test.skip(process.env.E2E_PRODUCTION !== "1", "needs a production build (see comment above)");
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Hold the server response for the create form (not the prefetch) to simulate a slow network.
  await page.route(
    (url) => url.pathname === "/tournaments/new",
    async (route) => {
      const headers = route.request().headers();
      if (headers["rsc"] === "1" && !headers["next-router-prefetch"]) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    },
  );

  await page.getByRole("contentinfo").getByRole("link", { name: "Create tournament" }).click();
  await expect(page.getByRole("status", { name: "Loading" })).toBeVisible();
  await expect(page.getByLabel("Tournament name")).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading" })).toHaveCount(0);
});

test("the date is spelled out under the picker", async ({ page }) => {
  await page.goto("/tournaments/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Date").fill("2026-10-03");
  await expect(page.getByText("Saturday, 3 October 2026")).toBeVisible();
});
