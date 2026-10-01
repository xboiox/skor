import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const PLAYERS = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi"];

test.beforeEach(async ({ context }) => {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  await context.setExtraHTTPHeaders({ "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` });
});

/** Navigates and waits until client components are hydrated, so taps are not lost. */
async function openReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

async function openTournament(page: Page) {
  await page.getByRole("link", { name: "Open tournament" }).click();
  await page.waitForURL(/\/t\/[2-9a-z]{6}\/admin$/);
  await page.waitForLoadState("networkidle");
}

async function fillWizard(page: Page, name: string, players: string[] = PLAYERS) {
  await openReady(page, "/tournaments/new");
  await page.getByLabel("Tournament name").fill(name);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Paste a list" }).click();
  await page.getByLabel("Paste names (one per line)").fill(players.join("\n"));
  await page.getByRole("button", { name: "Add all" }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
}

test("a guest creates an Americano tournament, opens it and starts it", async ({ page }) => {
  await fillWizard(page, "Friday Americano");
  await expect(page.getByText("kept for 7 days")).toBeVisible();
  await page.getByRole("button", { name: "Create tournament" }).click();

  await expect(page.getByText("✓ Tournament created")).toBeVisible();
  await expect(page.getByText("Save your admin link now")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Admin link (you)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Player link" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Public link" })).toBeVisible();

  await openTournament(page);
  await expect(page.getByRole("heading", { name: "Friday Americano" })).toBeVisible();
  await expect(page.getByText("Players (8)")).toBeVisible();

  await page.getByRole("button", { name: "Start tournament" }).click();
  await page.getByRole("button", { name: "Yes, start" }).click();
  await expect(page.getByRole("heading", { name: "Tournament started" })).toBeVisible();
  await expect(page.getByText("7 rounds scheduled for 8 players")).toBeVisible();
});

test("each step validates before moving on", async ({ page }) => {
  await openReady(page, "/tournaments/new");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Enter a name" })).toBeVisible();
  await expect(page.getByText("Step 1 of 4")).toBeVisible();

  await page.getByLabel("Tournament name").fill("Too few");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByLabel("Add player").fill("Solo");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add at least 4 players" })).toBeVisible();
});

test("tennis scoring with a custom number of games", async ({ page }) => {
  await openReady(page, "/tournaments/new");
  await page.getByLabel("Tournament name").fill("Tennis night");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await page.getByRole("radio", { name: /Tennis/ }).click();
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("Games (1–12)").fill("13");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.getByRole("alert").first()).toBeVisible();

  await page.getByLabel("Games (1–12)").fill("10");
  await page.getByRole("radio", { name: /Advantage/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
});

test("a signed-in host finds the tournament on the dashboard", async ({ page }) => {
  await openReady(page, "/register");
  await page.getByLabel("Name").fill("Host");
  await page.getByLabel("Email").fill(`host-${randomUUID()}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await fillWizard(page, "Club Mexicano");
  await expect(page.getByText("saved to your account")).toBeVisible();
  await page.getByRole("button", { name: "Create tournament" }).click();
  await expect(page.getByText("✓ Tournament created")).toBeVisible();
  await expect(page.getByText("Save your admin link now")).toHaveCount(0);

  await openReady(page, "/dashboard");
  await page.getByRole("link", { name: /Club Mexicano/ }).click();
  await expect(page.getByRole("heading", { name: "Club Mexicano" })).toBeVisible();
  await expect(page.getByText("Players (8)")).toBeVisible();
});

test("strangers cannot open the admin page", async ({ page, browser }) => {
  await fillWizard(page, "Private");
  await page.getByRole("button", { name: "Create tournament" }).click();
  const publicUrl = await page.getByLabel("Public link URL").inputValue();

  const stranger = await browser.newPage();
  await stranger.goto(`${publicUrl}/admin`);
  await expect(stranger.getByRole("heading", { name: "Host only" })).toBeVisible();
  await stranger.close();
});

test("the host manages players while in draft", async ({ page }) => {
  await fillWizard(page, "Roster", PLAYERS.slice(0, 4));
  await page.getByRole("button", { name: "Create tournament" }).click();
  await openTournament(page);
  await expect(page.getByText("Players (4)")).toBeVisible();

  await page.getByLabel("Player name").fill("Ida");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Players (5)")).toBeVisible();

  await page.getByLabel("Player name").fill("andi");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Andi is already in this tournament." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Remove Ida" }).click();
  await expect(page.getByText("Players (4)")).toBeVisible();
});

test("the create form fits a phone screen", async ({ page }) => {
  await page.goto("/tournaments/new");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
