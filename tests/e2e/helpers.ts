import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const PLAYERS = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi"];

export type Created = {
  id: string;
  slug: string;
  links: { admin: string; player: string; public: string };
};

export function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 250) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

/** A separate phone: same device profile (viewport, touch, baseURL) as the running project. */
export async function newDevice(browser: Browser): Promise<BrowserContext> {
  const { use } = test.info().project;
  return browser.newContext({ ...use, extraHTTPHeaders: { "x-forwarded-for": randomIp() } });
}

/** Creates and starts a tournament; returns the host's browser context (admin cookie set). */
export async function startedTournament(
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

export async function openReady(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
}

/** A player device: opens the player link and chooses who they are. */
export async function joinAs(browser: Browser, created: Created, name: string): Promise<Page> {
  const page = await (await newDevice(browser)).newPage();
  await openReady(page, created.links.player);
  await page.getByRole("button", { name: `I am ${name}` }).click();
  await expect(page.getByText(`You: ${name}`)).toBeVisible();
  return page;
}

export async function openMyMatch(page: Page) {
  await page
    .getByRole("heading", { name: /Your next match/ })
    .locator("..")
    .getByRole("link")
    .click();
  await page.waitForURL(/\/match\//);
  await page.waitForLoadState("networkidle");
}

export async function tap(page: Page, team: "A" | "B", times: number) {
  const panel = page.getByRole("button", { name: /^Point for/ }).nth(team === "A" ? 0 : 1);
  for (let i = 0; i < times; i += 1) await panel.click();
}
