import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "correct horse battery";

// Each test gets its own client IP so Better Auth's per-IP rate limit (3 / 10 s) never collides
// between parallel tests.
test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function register(page: Page, email: string, name = "Andi") {
  await page.goto("/register");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("register lands on the dashboard, sign out returns home", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Hi, Andi" })).toBeVisible();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)dashboard$/);
});

test("log in with email and password", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email, "Budi");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("heading", { name: "Hi, Budi" })).toBeVisible();
});

test("a wrong password shows a clear error", async ({ page }) => {
  const email = uniqueEmail();
  await register(page, email);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();

  // Next.js also renders an empty role="alert" route announcer, so match the form error by text.
  await expect(
    page.getByRole("alert").filter({ hasText: "Email or password is incorrect." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("signed-in users skip the login page", async ({ page }) => {
  await register(page, uniqueEmail());
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("login ignores an off-site next parameter", async ({ page }) => {
  await page.goto("/register?next=//evil.example");
  await page.getByLabel("Name").fill("Citra");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/);
});

test("auth form controls are thumb-sized", async ({ page }) => {
  await page.goto("/login");
  for (const control of [
    page.getByLabel("Email"),
    page.getByLabel("Password"),
    page.getByRole("button", { name: "Log in" }),
  ]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(48);
  }
});

test("an invalid tournament link shows a friendly page", async ({ page }) => {
  const response = await page.goto("/t/nope00/enter/admin?k=not-a-real-token");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "This link is not valid" })).toBeVisible();
});
