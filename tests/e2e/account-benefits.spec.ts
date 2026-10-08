import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const PLAYERS = ["Andi", "Budi", "Citra", "Dewi"];

test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

async function openReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** Fills the create form as a guest up to the review step. */
async function fillToReview(page: Page, name: string) {
  await openReady(page, "/tournaments/new");
  await page.getByLabel("Tournament name").fill(name);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Paste a list" }).click();
  await page.getByLabel("Paste names (one per line)").fill(PLAYERS.join("\n"));
  await page.getByRole("button", { name: "Add all" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
}

test("the home page explains what a free account adds", async ({ page }) => {
  await openReady(page, "/");
  const section = page.getByRole("region", { name: "Free account, more control" });
  await expect(section).toContainText("guest tournaments are deleted after 7 days");
  await expect(section).toContainText("Manage from any phone");
  await expect(section).toContainText("dashboard");
  await section.getByRole("link", { name: "Create free account" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("the guest option sits next to the main button, not in the headline", async ({ page }) => {
  await openReady(page, "/");
  await expect(page.getByText("Create a tournament in under two minutes.")).toBeVisible();
  await expect(page.getByText("No account needed.", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Swap in a substitute if someone can't play.")).toBeVisible();

  const footer = page.getByRole("contentinfo");
  await expect(
    footer.getByText("Or just create a tournament as a guest — no account needed."),
  ).toBeVisible();
  await expect(footer.getByRole("link", { name: "Create tournament" })).toBeVisible();
});

test("a guest can sign up from the review step without losing the form", async ({ page }) => {
  await fillToReview(page, "Saved Americano");
  await expect(page.getByText("deleted after 7 days")).toBeVisible();
  await page.getByRole("link", { name: "Log in to keep it →" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);

  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Name").fill("Host");
  await page.getByLabel("Email").fill(`host-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the form, at the review step, with everything still filled in.
  // The restored draft also restores its step in the URL.
  await expect(page).toHaveURL(/\/tournaments\/new(\?step=3)?$/);
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await expect(page.getByText("Saved Americano")).toBeVisible();
  await expect(page.getByText("4: Andi, Budi, Citra, Dewi")).toBeVisible();
  await expect(page.getByText("This tournament is saved to your account.")).toBeVisible();

  await page.getByRole("button", { name: "Create tournament" }).click();
  await expect(page.getByText("✓ Tournament created")).toBeVisible();
  await expect(page.getByText("Save your admin link now")).toHaveCount(0);

  // The draft is gone once the tournament exists.
  await openReady(page, "/tournaments/new");
  await expect(page.getByLabel("Tournament name")).toHaveValue("");
});

test("the form survives a reload", async ({ page }) => {
  await fillToReview(page, "Reload proof");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await expect(page.getByText("Reload proof")).toBeVisible();
});

test("guests are reminded after creating that an account removes the admin-link worry", async ({
  page,
}) => {
  await fillToReview(page, "Guest night");
  await page.getByRole("button", { name: "Create tournament" }).click();
  await expect(page.getByText("Save your admin link now")).toBeVisible();
  await expect(page.getByRole("link", { name: "log in first" })).toHaveAttribute("href", "/login");
});

test("signed in, the home page shows My tournaments instead of sign-up prompts", async ({
  page,
}) => {
  await openReady(page, "/register");
  await page.getByLabel("Name").fill("Host");
  await page.getByLabel("Email").fill(`home-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Tapping the logo from the dashboard must not look like being logged out.
  await page.getByRole("banner").getByRole("link", { name: "Skor." }).click();
  await expect(page).toHaveURL(/\/$/);
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "My tournaments" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Free account, more control" })).toHaveCount(0);
  await expect(page.getByText("Or just create a tournament as a guest")).toHaveCount(0);

  await header.getByRole("link", { name: "My tournaments" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
