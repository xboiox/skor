import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

async function openReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
}

const headerBack = (page: Page) => page.getByRole("banner").getByRole("link", { name: "← Back" });
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true });

test.describe("login and register", () => {
  test("Back returns to the previous page", async ({ page }) => {
    await openReady(page, "/");
    await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await settle(page);

    await headerBack(page).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("opened directly (e.g. from a shared link), Back goes home", async ({ page }) => {
    await openReady(page, "/login");
    await headerBack(page).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("opened directly with ?next=, Back goes where the user was heading", async ({ page }) => {
    await openReady(page, "/login?next=%2Ftournaments%2Fnew");
    await headerBack(page).click();
    await expect(page).toHaveURL(/\/tournaments\/new$/);
  });

  test("register → Back → login → Back → home", async ({ page }) => {
    await openReady(page, "/");
    await page.getByRole("banner").getByRole("link", { name: "Log in" }).click();
    await settle(page);
    await page.getByRole("link", { name: "Create an account" }).click();
    await expect(page).toHaveURL(/\/register/);
    await settle(page);

    await headerBack(page).click();
    await expect(page).toHaveURL(/\/login$/);
    await settle(page);
    await headerBack(page).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("create tournament", () => {
  async function startFromHome(page: Page) {
    await openReady(page, "/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Create tournament" }).click();
    await expect(page).toHaveURL(/\/tournaments\/new$/);
    await settle(page);
  }

  test("Back on the first step leaves the form", async ({ page }) => {
    await startFromHome(page);
    await page.getByRole("link", { name: "Back", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("the phone's own back button goes back one step", async ({ page }) => {
    await startFromHome(page);
    await page.getByLabel("Tournament name").fill("Steps");
    await next(page).click();
    await expect(page).toHaveURL(/\?step=1$/);
    await next(page).click();
    await expect(page).toHaveURL(/\?step=2$/);
    await expect(page.getByText("Step 3 of 4")).toBeVisible();

    await page.goBack();
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.getByLabel("Tournament name")).toHaveValue("Steps");
  });

  test("the form has only the Back next to Next, none in the header", async ({ page }) => {
    await startFromHome(page);
    await expect(headerBack(page)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
  });

  test("typing keeps focus in the field", async ({ page }) => {
    await openReady(page, "/tournaments/new");
    await page.getByLabel("Tournament name").click();
    await page.keyboard.type("Typed letter by letter");
    await expect(page.getByLabel("Tournament name")).toHaveValue("Typed letter by letter");
  });

  test("the created screen has no Back", async ({ page }) => {
    await openReady(page, "/tournaments/new");
    await page.getByLabel("Tournament name").fill("Done");
    await next(page).click();
    await next(page).click();
    await page.getByRole("button", { name: "Paste a list" }).click();
    await page.getByLabel("Paste names (one per line)").fill("A\nB\nC\nD");
    await page.getByRole("button", { name: "Add all" }).click();
    await next(page).click();
    await page.getByRole("button", { name: "Create tournament" }).click();
    await expect(page.getByText("✓ Tournament created")).toBeVisible();
    await expect(headerBack(page)).toHaveCount(0);
  });
});
