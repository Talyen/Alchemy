import { savedActivityFixture } from "../fixtures/run-activity";
import { destinationLabel } from "@/lib/routing/destinations";
import { expect, type Page } from "@playwright/test";
import type { BattleCard } from "@/lib/game-data/types";
import { BattlePage } from "../pages/battle-page";
import { DestinationPage } from "../pages/destination-page";
import { RewardPage } from "../pages/reward-page";
import { makeStartingDeck } from "./cards";
import { navigateToGame } from "./navigation";
import { injectSaveState } from "./save-injection";
import type { DestinationName } from "./types";

export async function enableFastMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("alchemy-disable-animations", "true");
  });
}

export async function startAtDestination(
  page: Page,
  overrides: Record<string, unknown>,
  options: { forceDestination: DestinationName },
) {
  const loaded = await injectSaveState(page, {
    runGold: 50,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    runDeck: makeStartingDeck(),
    ...overrides,
    activity: savedActivityFixture("destination", {
      destinations: [options.forceDestination],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    }),
  });
  if (!loaded) await navigateToGame(page);
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 8000 });
  await expect(page.getByRole("button", { name: destinationLabel(options.forceDestination), exact: true })).toBeVisible(
    { timeout: 3000 },
  );
}

export async function startBattleWithDeck(page: Page, deck: BattleCard[], overrides: Record<string, unknown> = {}) {
  const loaded = await injectSaveState(page, {
    runDeck: deck,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    activity: savedActivityFixture("destination", {
      destinations: ["Normal Combat"],
      selectedBossId: null,
      lastVictoryEnemyType: null,
      lastVictoryContentSystem: null,
    }),
    ...overrides,
  });
  if (!loaded) await navigateToGame(page);
  const destination = new DestinationPage(page);
  await destination.expectVisible();
  await destination.enterCombat("Combat");
}

export async function assertEndRunShowsRecap(page: Page) {
  await new BattlePage(page).menuBtn.click();
  await page.getByRole("button", { name: "End Run" }).click();
  await page
    .getByRole("dialog", { name: "End this run?" })
    .getByRole("button", { name: "End Run", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Journey’s End" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Main Menu" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Main Menu" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10000 });
}

export async function winBattleAndClaimReward(page: Page, maxTurns = 6) {
  await new BattlePage(page).winViaCombat(maxTurns);
  await new RewardPage(page).claimFirstReward();
}
