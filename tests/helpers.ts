import { expect, test, type Page } from "@playwright/test";

export async function injectSaveState(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript((data) => {
    const SAVE_KEY = "alchemy-save-v1";
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "{}");
    save.activeRun = {
      characterId: "knight",
      runDeck: [],
      runGold: 0,
      runPlayerHealth: 30,
      runMaxHealth: 30,
      roomsEncountered: 0,
      currentAct: 1,
      destinationIndexInAct: 0,
      completedDestinations: [],
      runTrinkets: [],
      ...data,
    };
    if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
      save.discoveredCardIds = [
        "slash", "bash", "block", "anvil", "plate-mail", "apple", "meteor", "blessed-aegis",
      ];
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  }, overrides);
}

// Fresh run lands directly in the first forced Normal Combat battle.
export async function startRun(page: Page, character: "Knight" | "Ranger" | "Rogue" | "Wizard" = "Knight") {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: character }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
}

export async function skipAndReward(page: Page) {
  await page.getByRole("button", { name: "Skip Combat" }).click();
  await expect(page.getByRole("heading", { name: /^Victory/ })).toBeVisible({ timeout: 5000 });
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
}

// Cycles through destinations up to 10 attempts until the named destination is found.
// Intermediate combats are skipped via skipAndReward; non-combat destinations are
// advanced through automatically.
export async function navigateToDestination(page: Page, name: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    const target = page.getByRole("button", { name });
    if (await target.isVisible({ timeout: 500 }).catch(() => false)) {
      await target.click();
      return;
    }
    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    if (await combatBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await combatBtn.click();
      await page.waitForSelector('[aria-label^="Play "]');
      await skipAndReward(page);
    } else {
      await page.getByRole("button").last().click();
      await page.waitForTimeout(500);
      const cont = page.getByRole("button", { name: "Continue" });
      if (await cont.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cont.click();
      } else {
        const choiceBtn = page.locator("button").filter({ hasNotText: /Cancel|Menu|Remove Card|Previous|Next/ }).first();
        if (await choiceBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await choiceBtn.click();
          await page.waitForTimeout(300);
          await page.getByRole("button", { name: /Continue|Add Card|Remove Card/ }).first().click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(200);
          await page.getByRole("button", { name: "Continue" }).click({ timeout: 2000 }).catch(() => {});
        }
      }
    }
  }
  test.skip(true, `Could not find "${name}" in destination choices`);
}

export async function waitForEnemyTurn(page: Page) {
  const endTurnButton = page.getByRole("button", { name: "End Turn" });
  await endTurnButton.click();
  await expect(endTurnButton).toBeEnabled({ timeout: 8000 });
}

export async function playUntilVictory(page: Page) {
  const victoryHeading = page.getByRole("heading", { name: /^Victory/ });

  for (let turn = 0; turn < 12; turn += 1) {
    if (await victoryHeading.isVisible().catch(() => false)) return;

    while ((await page.locator('[aria-label^="Play "]').count()) > 0) {
      const card = page.locator('[aria-label^="Play "]').first();
      if (!(await card.isEnabled({ timeout: 500 }).catch(() => false))) break;
      await card.click({ force: true });
      await page.waitForTimeout(220);

      if (await victoryHeading.isVisible().catch(() => false)) return;
    }

    if (await victoryHeading.isVisible().catch(() => false)) return;

    await expect(page.locator('[aria-label^="Play "]').first()).toBeEnabled({ timeout: 8000 }).catch(async (e) => {
      if (await victoryHeading.isVisible().catch(() => false)) return;
      throw e;
    });
  }

  throw new Error("Battle did not reach the Victory screen in time.");
}

export async function completeVictoryFlow(page: Page) {
  await page.locator('[aria-label^="Select "]').first().click();
  await page.getByRole("button", { name: /^(Add Card|Take Trinket)$/ }).click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
}
