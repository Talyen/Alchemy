import { expect, type Page } from "@playwright/test";

export async function startRun(page: Page, character: "Knight" | "Ranger" | "Rogue" | "Sorcerer" = "Knight") {
  await page.goto("/");
  await page.getByRole("button", { name: "Play" }).click();
  await page.getByRole("button", { name: character }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /Combat/ }).first().click();
  await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
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
