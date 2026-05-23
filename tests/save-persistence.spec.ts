import { expect, test } from "@playwright/test";
import { injectSaveState, openGameModeSelect, resumeGameMode, seedRandomScript } from "./helpers";

test.describe("Save Persistence Edge Cases", () => {
  test("resume run restores exact state after reload", async ({ page }) => {
    await page.addInitScript(seedRandomScript(42));
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

    const savedBefore = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      return s.activeRun;
    });
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

    const savedAfter = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("alchemy-save-v1") || "{}");
      return s.activeRun;
    });
    expect(savedAfter.runGold).toBe(42);
    expect(savedAfter.runPlayerHealth).toBe(18);
  });

  test("mid-battle reload returns to destination not battle", async ({ page }) => {
    await page.addInitScript(seedRandomScript(42));
    await injectSaveState(page, {
      runPlayerHealth: 22,
      runMaxHealth: 30,
      roomsEncountered: 2,
      destinationIndexInAct: 1,
      completedDestinations: ["Normal Combat"],
    });
    await page.goto("/");

    await resumeGameMode(page, "campaign");

    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[aria-label^="Play "]')).toHaveCount(0);
  });
});
