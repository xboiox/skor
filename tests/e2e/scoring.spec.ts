import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const PLAYERS = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi"];

type Created = {
  id: string;
  slug: string;
  links: { admin: string; player: string; public: string };
};

function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

/** A separate phone: same device profile (viewport, touch, baseURL) as the running project. */
async function newDevice(browser: Browser): Promise<BrowserContext> {
  const { use } = test.info().project;
  return browser.newContext({ ...use, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
}

/** Creates and starts a tournament; returns the host's browser context (admin cookie set). */
async function startedTournament(
  browser: Browser,
  baseURL: string,
  overrides: Record<string, unknown> = {},
): Promise<{ created: Created; host: BrowserContext }> {
  const host = await newDevice(browser);
  const res = await host.request.post("/api/tournaments", {
    headers: { origin: baseURL },
    data: {
      name: "Scoring night",
      date: "2026-10-03",
      matchType: "americano",
      courts: 2,
      scoring: { type: "rally", totalPoints: 16 },
      players: PLAYERS,
      ...overrides,
    },
  });
  const created = (await res.json()).data as Created;
  await host.request.get(created.links.admin);
  const start = await host.request.post(`/api/tournaments/${created.id}/start`, {
    headers: { origin: baseURL },
  });
  expect(start.ok()).toBe(true);
  return { created, host };
}

async function openReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** A player device: opens the player link and chooses who they are. */
async function joinAs(browser: Browser, created: Created, name: string): Promise<Page> {
  const page = await (await newDevice(browser)).newPage();
  await openReady(page, created.links.player);
  await page.getByRole("button", { name: `I am ${name}` }).click();
  await expect(page.getByText(`You: ${name}`)).toBeVisible();
  return page;
}

async function openMyMatch(page: Page) {
  await page
    .getByRole("heading", { name: /Your next match/ })
    .locator("..")
    .getByRole("link")
    .click();
  await page.waitForURL(/\/match\//);
  await page.waitForLoadState("networkidle");
}

async function tap(page: Page, team: "A" | "B", times: number) {
  const panel = page.getByRole("button", { name: /^Point for/ }).nth(team === "A" ? 0 : 1);
  for (let i = 0; i < times; i += 1) await panel.click();
}

test("a player scores a match live and the host approves it", async ({ browser, baseURL }) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Andi");
  await openMyMatch(player);

  await tap(player, "A", 10);
  await tap(player, "B", 6);
  await expect(player.getByText("Waiting for host approval")).toBeVisible();
  await expect(player.getByText("0 left")).toBeVisible();
  await expect(player.getByRole("button", { name: /^Point for/ }).first()).toBeDisabled();

  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin`);
  await expect(admin.getByRole("heading", { name: "Needs approval (1)" })).toBeVisible();
  await admin.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(admin.getByRole("heading", { name: "Needs approval (0)" })).toBeVisible();

  await player.reload();
  await expect(player.getByText("Final ✓")).toBeVisible();
});

test("undo and the final-result sheet", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Budi");
  await openMyMatch(player);

  await tap(player, "A", 2);
  await expect(player.getByText("14 left")).toBeVisible();
  await player.getByRole("button", { name: "↶ Undo" }).click();
  await expect(player.getByText("15 left")).toBeVisible();

  await player.getByRole("button", { name: "Final…" }).click();
  const sheet = player.getByRole("dialog", { name: "Final result" });
  await sheet.getByRole("spinbutton").first().fill("9");
  await sheet.getByRole("spinbutton").last().fill("9");
  await sheet.getByRole("button", { name: "Submit" }).click();
  // The error shows inside the sheet, which stays open for a correction.
  await expect(sheet.getByRole("alert")).toHaveText("Scores must add up to 16 points (got 18).");

  await sheet.getByRole("spinbutton").last().fill("7");
  await sheet.getByRole("button", { name: "Submit" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(player.getByText("Waiting for host approval")).toBeVisible();
});

test("two phones scoring the same match stay in sync", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const first = await joinAs(browser, created, "Andi");
  await openMyMatch(first);
  const matchUrl = first.url();

  const second = await joinAs(browser, created, "Budi");
  await openReady(second, matchUrl);

  await tap(first, "A", 1);
  await expect(first.getByText("15 left")).toBeVisible();
  await expect(first.getByText("Live")).toBeVisible();

  await tap(second, "B", 1); // second phone still thinks it is 0-0
  await expect(
    second.getByRole("alert").filter({ hasText: "Score was updated on another phone." }),
  ).toBeVisible();
  await expect(second.getByText("15 left")).toBeVisible();

  await tap(second, "B", 1);
  await expect(second.getByText("14 left")).toBeVisible();
});

test("strangers and players without an identity are kept out", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const stranger = await (await newDevice(browser)).newPage();
  await openReady(stranger, `/t/${created.slug}/play`);
  await expect(stranger.getByRole("heading", { name: "Players only" })).toBeVisible();

  const player = await (await newDevice(browser)).newPage();
  await openReady(player, created.links.player);
  await expect(player.getByRole("heading", { name: "Who are you?" })).toBeVisible();
});

test("Mexicano: the next round opens once every result is approved", async ({
  browser,
  baseURL,
}) => {
  const { created, host } = await startedTournament(browser, baseURL!, { matchType: "mexicano" });
  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin`);
  await expect(
    admin.getByRole("button", { name: "Approve all of round 1 to continue" }),
  ).toBeDisabled();

  for (let court = 0; court < 2; court += 1) {
    await admin.getByRole("button", { name: "Edit", exact: true }).nth(court).click();
    const sheet = admin.getByRole("dialog", { name: "Set result (host)" });
    await sheet.getByRole("spinbutton").first().fill("10");
    await sheet.getByRole("spinbutton").last().fill("6");
    await sheet.getByRole("button", { name: "Submit" }).click();
    await expect(sheet).toHaveCount(0);
  }

  await admin.getByRole("button", { name: "Start round 2" }).click();
  await expect(admin.getByText("Round 2 · now")).toBeVisible();
});

test("the host replaces a player for one round with a new player", async ({ browser, baseURL }) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin/replace`);

  await admin.getByRole("button", { name: "Andi", exact: true }).click();
  await admin.getByLabel("Name").fill("Joko");
  await admin.getByRole("button", { name: "Preview change" }).click();
  await expect(admin.getByRole("status")).toContainText("Joko will play round");
  await admin.getByRole("button", { name: "Confirm" }).click();
  await admin.waitForURL(/\/admin$/);
  await expect(admin.getByText(/Joko/).first()).toBeVisible();
});

test("QR codes and ending the tournament", async ({ browser, baseURL }) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin`);

  await admin.getByRole("button", { name: "Show QR" }).first().click();
  await expect(admin.getByRole("img", { name: "QR code" })).toBeVisible();

  await admin.getByRole("button", { name: "End tournament" }).click();
  await admin.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(admin.getByText("This tournament has ended. Results are final.")).toBeVisible();
});

test("score panels are big enough to hit from the side of the court", async ({
  browser,
  baseURL,
}) => {
  const { created } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Citra");
  await openMyMatch(player);

  const viewport = player.viewportSize()!;
  for (const panel of await player.getByRole("button", { name: /^Point for/ }).all()) {
    const box = await panel.boundingBox();
    const share =
      viewport.width > viewport.height
        ? box!.width / viewport.width
        : box!.height / viewport.height;
    expect(share).toBeGreaterThanOrEqual(0.3);
  }
  const overflow = await player.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
