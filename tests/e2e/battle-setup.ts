// Battle and destination bootstrap helpers for E2E specs.
import { expect, type Page } from "@playwright/test";
import type { BattleCard } from "@/lib/game-data";
import { BattlePage } from "../pages/battle-page";
import { DestinationPage } from "../pages/destination-page";
import { RewardPage } from "../pages/reward-page";
import { STARTING_DECK } from "./cards";
import { resumeCampaignRun } from "./navigation";
import { injectSaveState, destinationInterruptedFlow } from "./save-injection";
import type { DestinationName } from "./types";
import { completeRunEndToMenu } from "./run-end";

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
    runDeck: STARTING_DECK,
    ...overrides,
    ...(options.forceDestination
      ? { currentScreen: "destination", interruptedFlow: destinationInterruptedFlow([options.forceDestination]) }
      : {}),
  });
  await page.goto("/");
  if (options.forceDestination) {
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
  } else {
    await resumeCampaignRun(page);
  }
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
  if (options.forceDestination) {
    await expect(page.getByRole("button", { name: options.forceDestination })).toBeVisible({ timeout: 3000 });
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
    await completeRunEndToMenu(page);
  }
}

/** Win the current battle via combat and claim the first reward card. */
export async function winBattleAndClaimReward(page: Page, maxTurns = 6) {
  await new BattlePage(page).winViaCombat(maxTurns);
  await new RewardPage(page).claimFirstReward();
}
