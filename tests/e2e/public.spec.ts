import { expect, test, type Page } from "@playwright/test";
import {
  PLAYERS,
  joinAs,
  newDevice,
  openMyMatch,
  openReady,
  startedTournament,
  tap,
  tapTeamOf,
  type Created,
} from "./helpers";

async function viewer(browser: Parameters<typeof newDevice>[0], created: Created): Promise<Page> {
  const page = await (await newDevice(browser)).newPage();
  await openReady(page, created.links.public);
  return page;
}

const rowOf = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(name) }).first();

test("anyone with the public link sees the leaderboard, without player or host tools", async ({
  browser,
  baseURL,
}) => {
  const { created } = await startedTournament(browser, baseURL!);
  const page = await viewer(browser, created);

  await expect(page.getByRole("heading", { name: "Scoring night" })).toBeVisible();
  for (const name of PLAYERS) await expect(rowOf(page, name)).toBeVisible();
  await expect(page.getByText("1=").first()).toBeVisible(); // everyone level before any match
  await expect(page.getByRole("navigation", { name: "Tournament", exact: true })).toHaveCount(0);

  await page.getByRole("link", { name: "Rounds" }).click();
  await expect(page.getByRole("heading", { name: /Round 1 · now/ })).toBeVisible();
  await expect(page.locator('a[href*="/match/"]')).toHaveCount(0); // cards are not links for viewers
});

test("live scores show as provisional until the host approves them", async ({
  browser,
  baseURL,
}) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const page = await viewer(browser, created);

  const player = await joinAs(browser, created, "Andi");
  await openMyMatch(player);
  await tapTeamOf(player, "Andi", 10);
  await tapTeamOf(player, "Andi", 6, true);
  await expect(player.getByText("Waiting for host approval")).toBeVisible();

  // Live view updates on its own and marks the rows.
  await expect(rowOf(page, "Andi")).toContainText("⏱ live");
  await expect(rowOf(page, "Andi")).toContainText("10");
  await expect(
    page.getByText("⏱ live = includes scores not yet approved by the host."),
  ).toBeVisible();

  await page.getByRole("link", { name: "Final only" }).click();
  await expect(page).toHaveURL(/view=final/);
  await expect(rowOf(page, "Andi")).not.toContainText("⏱ live");

  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin`);
  await admin.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(rowOf(page, "Andi")).toContainText("+4");
  await expect(rowOf(page, "Andi")).not.toContainText("⏱ live");
});

test("tapping a player shows their matches", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Budi");
  await openMyMatch(player);
  await tap(player, "A", 3);
  await expect(player.getByText("13 left")).toBeVisible();

  const page = await viewer(browser, created);
  await rowOf(page, "Budi").click();
  await expect(rowOf(page, "Budi")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/R1 with .+ vs .+/)).toBeVisible();
});

test("a draft shows who is playing; a finished tournament says so", async ({
  browser,
  baseURL,
}) => {
  const host = await newDevice(browser);
  const res = await host.request.post("/api/tournaments", {
    headers: { origin: baseURL! },
    data: {
      name: "Soon",
      date: "2026-10-03",
      matchType: "mexicano",
      courts: 1,
      scoring: { type: "rally", totalPoints: 16 },
      players: PLAYERS.slice(0, 4),
    },
  });
  const created = (await res.json()).data as Created;
  const page = await viewer(browser, created);
  await expect(page.getByRole("heading", { name: "Starting soon" })).toBeVisible();

  await host.request.get(created.links.admin);
  await host.request.post(`/api/tournaments/${created.id}/start`, {
    headers: { origin: baseURL! },
  });
  await host.request.post(`/api/tournaments/${created.id}/end`, { headers: { origin: baseURL! } });
  await expect(page.getByText("Final results")).toBeVisible();
});

test("players see the Leaderboard and Matches tabs", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Citra");
  await player
    .getByRole("navigation", { name: "Tournament" })
    .getByRole("link", { name: "Leaderboard" })
    .click();
  await expect(player).toHaveURL(new RegExp(`/t/${created.slug}$`));
  await expect(rowOf(player, "Citra")).toContainText("You");
  await expect(
    player
      .getByRole("navigation", { name: "Tournament", exact: true })
      .getByRole("link", { name: "Matches" }),
  ).toBeVisible();
});

test("the leaderboard fits a phone and rows are easy to tap", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const page = await viewer(browser, created);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await rowOf(page, "Andi").boundingBox();
  expect(box?.height).toBeGreaterThanOrEqual(48);
});
