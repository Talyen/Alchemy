import { expect, test } from "@playwright/test";
import { injectSaveState, openGameModeSelect, resumeCampaignRun, SAVE_KEY, seedRandom } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Save Persistence Edge Cases", critical, () => {
  test("resume run restores exact state after reload", async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      characterId: "knight",
      runGold: 42,
      runPlayerHealth: 18,
      runMaxHealth: 30,
      roomsEncountered: 3,
      currentAct: 1,
      destinationIndexInAct: 2,
      completedDestinations: ["Normal Combat", "Normal Combat"],
    });
    await page.goto("/");

    const savedBefore = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s.activeRun;
    }, SAVE_KEY);
    expect(savedBefore.runGold).toBe(42);
    expect(savedBefore.runPlayerHealth).toBe(18);
    expect(savedBefore.runMaxHealth).toBe(30);
    expect(savedBefore.currentAct).toBe(1);
    expect(savedBefore.destinationIndexInAct).toBe(2);

    await openGameModeSelect(page);
    await page.getByRole("button", { name: /The Campaign/ }).click();
    await expect(page.getByRole("button", { name: "Resume" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });

    const savedAfter = await page.evaluate((saveKey) => {
      const s = JSON.parse(localStorage.getItem(saveKey) || "{}");
      return s.activeRun;
    }, SAVE_KEY);
    expect(savedAfter.runGold).toBe(42);
    expect(savedAfter.runPlayerHealth).toBe(18);
  });

  test("resume restores saved destination choices", async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
      currentScreen: "destination",
      destinationChoices: ["Campfire", "Mystery", "Merchant's Shop"],
    });
    await page.goto("/");

    // currentScreen: destination hydrates before menu is stable; Resume via Play races bootstrap.
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Campfire" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mystery" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Merchant's Shop" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Normal Combat" })).toHaveCount(0);
  });

  test("mid-battle reload returns to destination not battle", async ({ page }) => {
    await seedRandom(page, 42);
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
    });
    await page.goto("/");

    await resumeCampaignRun(page);

    await expect(page.locator('[aria-label^="Play "]')).toHaveCount(0);
  });
});
