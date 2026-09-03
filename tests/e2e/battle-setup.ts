import { expect, type Page } from "@playwright/test";
import type { BattleCard } from "@/lib/game-data/types";
import { BattlePage } from "../pages/battle-page";
import { DestinationPage } from "../pages/destination-page";
import { RewardPage } from "../pages/reward-page";
import { makeStartingDeck } from "./cards";
import { resumeCampaignRun } from "./navigation";
import { injectSaveState, destinationInterruptedFlow } from "./save-injection";
import type { DestinationName } from "./types";

export async function enableFastMode(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("alchemy-disable-animations", "true");
  });
}

export async function startAtDestination(
  page: Page,
  overrides: Record<string, unknown> = {},
  options: { forceDestination?: DestinationName } = {},
) {
  await injectSaveState(page, {
    runGold: 50,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    runDeck: makeStartingDeck(),
    ...overrides,
    ...(options.forceDestination
      ? { currentScreen: "destination", interruptedFlow: destinationInterruptedFlow([options.forceDestination]) }
      : {}),
  });
  await page.goto("/");
  if (options.forceDestination) {
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("button", { name: options.forceDestination })).toBeVisible({ timeout: 3000 });
  } else {
    await resumeCampaignRun(page);
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  }
}

export async function startBattleWithDeck(page: Page, deck: BattleCard[], overrides: Record<string, unknown> = {}) {
  await injectSaveState(page, {
    runDeck: deck,
    runPlayerHealth: 30,
    runMaxHealth: 30,
    currentScreen: "destination",
    interruptedFlow: destinationInterruptedFlow(["Normal Combat"]),
    ...overrides,
  });
  await page.goto("/");
  const destination = new DestinationPage(page);
  await destination.expectVisible();
  await destination.enterCombat("Normal Combat");
}

export async function assertDefeatFromEndRun(page: Page, options: { returnToMenu?: boolean } = {}) {
  const battle = new BattlePage(page);
  await battle.menuBtn.click();
  await page.getByRole("button", { name: "End Run" }).click();
  await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
  if (options.returnToMenu) {
    const continueBtn = page.getByRole("button", { name: "Continue" });
    await expect(continueBtn).toBeVisible({ timeout: 5000 });
    await continueBtn.click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10000 });
  }
}

export async function winBattleAndClaimReward(page: Page, maxTurns = 6) {
  await new BattlePage(page).winViaCombat(maxTurns);
  await new RewardPage(page).claimFirstReward();
}
