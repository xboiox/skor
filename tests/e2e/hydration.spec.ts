import { expect, test, type Page } from "@playwright/test";
import { newDevice, openReady, startedTournament } from "./helpers";

/** Like desktop Chrome or a phone: the Web Share API exists (headless test browsers lack it). */
async function withWebShare(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: async () => {}, configurable: true });
  });
}

function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /hydrat/i.test(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (/hydrat/i.test(err.message)) errors.push(err.message);
  });
  return errors;
}

test("the admin page hydrates cleanly when Web Share is available", async ({
  browser,
  baseURL,
}) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const admin = await host.newPage();
  await withWebShare(admin);
  const errors = collectHydrationErrors(admin);

  await openReady(admin, `/t/${created.slug}/admin`);
  await expect(admin.getByRole("button", { name: "Share" }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("the created screen and pages with link cards hydrate cleanly", async ({ browser }) => {
  const page = await (await newDevice(browser)).newPage();
  await withWebShare(page);
  const errors = collectHydrationErrors(page);

  await openReady(page, "/tournaments/new");
  await openReady(page, "/");
  expect(errors).toEqual([]);
});

test("player, scoring, public and auth pages hydrate cleanly", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const page = await (await newDevice(browser)).newPage();
  await withWebShare(page);
  const errors = collectHydrationErrors(page);

  await openReady(page, created.links.player);
  await page.getByRole("button", { name: "I am Andi" }).click();
  await expect(page.getByText("You: Andi")).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");

  await page
    .getByRole("heading", { name: /Your next match/ })
    .locator("..")
    .getByRole("link")
    .click();
  await page.waitForURL(/\/match\//);
  await page.waitForLoadState("networkidle");

  for (const path of [
    created.links.public,
    `${created.links.public}?tab=rounds`,
    "/login",
    "/register",
  ]) {
    await openReady(page, path);
  }
  expect(errors).toEqual([]);
});
