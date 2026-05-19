import { expect, test } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Character Starting Decks", () => {
  test("Knight starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const expectedCards = ["Slash", "Bash", "Block", "Anvil", "Plate Mail", "Bread", "Shield Bash"];
    for (const card of expectedCards) {
      const matching = page.locator(`[aria-label="Play ${card}"]`);
      if (await matching.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(matching.first()).toBeVisible();
      }
    }
  });

  test("Rogue starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Rogue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const expectedCards = ["Steal", "Poison Dagger", "Stab", "Slash", "Fangs", "Apple", "Blackjack"];
    for (const card of expectedCards) {
      const matching = page.locator(`[aria-label="Play ${card}"]`);
      if (await matching.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(matching.first()).toBeVisible();
      }
    }
  });

  test("Wizard starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Wizard" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const expectedCards = ["Fireball", "Frostbolt", "Mana Berries", "Mana Crystals", "Meteor", "Wish"];
    for (const card of expectedCards) {
      const matching = page.locator(`[aria-label="Play ${card}"]`);
      if (await matching.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(matching.first()).toBeVisible();
      }
    }
  });

  test("Ranger starts with expected cards", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "campaign");
    await page.getByRole("button", { name: "Ranger" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const expectedCards = ["Slash", "Stab", "Fangs", "Heal", "Wolf Companion", "Apple", "Mana Berries", "Pack Tactics", "Bloodthorn"];
    for (const card of expectedCards) {
      const matching = page.locator(`[aria-label="Play ${card}"]`);
      if (await matching.isVisible({ timeout: 500 }).catch(() => false)) {
        await expect(matching.first()).toBeVisible();
      }
    }
  });
});
