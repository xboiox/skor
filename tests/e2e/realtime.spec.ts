import { expect, test } from "@playwright/test";
import {
  PLAYERS,
  joinAs,
  newDevice,
  openMyMatch,
  openReady,
  startedTournament,
  tap,
  type Created,
} from "./helpers";

test("a watching phone sees scores change without reloading", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const watcher = await joinAs(browser, created, "Hadi");
  await expect(watcher.getByText("Live", { exact: true })).toBeVisible();

  const scorer = await joinAs(browser, created, "Andi");
  await openMyMatch(scorer);
  await tap(scorer, "A", 3);
  await expect(scorer.getByText("13 left")).toBeVisible();

  // The watcher's match list updates on its own (no reload).
  const card = watcher.getByRole("link").filter({ hasText: "Andi" }).first();
  await expect(card).toContainText("Live");
  await expect(card).toContainText("3");
});

test("the host's approval queue fills in as players submit", async ({ browser, baseURL }) => {
  const { created, host } = await startedTournament(browser, baseURL!);
  const admin = await host.newPage();
  await openReady(admin, `/t/${created.slug}/admin`);
  await expect(admin.getByRole("heading", { name: "Needs approval (0)" })).toBeVisible();

  const player = await joinAs(browser, created, "Budi");
  await openMyMatch(player);
  await tap(player, "B", 16);
  await expect(player.getByText("Waiting for host approval")).toBeVisible();

  await expect(admin.getByRole("heading", { name: "Needs approval (1)" })).toBeVisible();
});

test("two phones on the same match move together without conflicts", async ({
  browser,
  baseURL,
}) => {
  const { created } = await startedTournament(browser, baseURL!);
  const first = await joinAs(browser, created, "Andi");
  await openMyMatch(first);
  const second = await joinAs(browser, created, "Budi");
  await openReady(second, first.url());
  await expect(second.getByText("Live", { exact: true })).toBeVisible();

  await tap(first, "A", 2);
  await expect(second.getByText("14 left")).toBeVisible(); // pushed, not tapped

  await tap(second, "B", 1); // already in sync, so no conflict
  await expect(first.getByText("13 left")).toBeVisible();
  await expect(second.getByText("Score was updated on another phone.")).toHaveCount(0);
});

test("players waiting for the start see the matches appear", async ({ browser, baseURL }) => {
  const host = await newDevice(browser);
  const res = await host.request.post("/api/tournaments", {
    headers: { origin: baseURL! },
    data: {
      name: "Not yet",
      date: "2026-10-03",
      matchType: "americano",
      courts: 2,
      scoring: { type: "rally", totalPoints: 16 },
      players: PLAYERS,
    },
  });
  const created = (await res.json()).data as Created;
  await host.request.get(created.links.admin);

  const player = await (await newDevice(browser)).newPage();
  await openReady(player, created.links.player);
  await expect(player.getByText("Waiting for the host to start the tournament.")).toBeVisible();
  await expect(player.getByText("Live", { exact: true })).toBeVisible();

  await host.request.post(`/api/tournaments/${created.id}/start`, {
    headers: { origin: baseURL! },
  });
  await expect(player.getByRole("heading", { name: "Who are you?" })).toBeVisible();
});

test("scoring pauses while the phone is offline", async ({ browser, baseURL }) => {
  const { created } = await startedTournament(browser, baseURL!);
  const player = await joinAs(browser, created, "Citra");
  await openMyMatch(player);

  await player.context().setOffline(true);
  await expect(
    player.getByText("No connection — scoring is paused until you are back online."),
  ).toBeVisible();
  await expect(player.getByRole("button", { name: /^Point for/ }).first()).toBeDisabled();

  await player.context().setOffline(false);
  await expect(player.getByRole("button", { name: /^Point for/ }).first()).toBeEnabled();
  await tap(player, "A", 1);
  await expect(player.getByText("15 left")).toBeVisible();
});
