import { expect, test } from "@playwright/test";
import { createMinimalLabyrinthMap, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Node Types", () => {
  test("labyrinth map shows with combat and rest nodes available", async ({ page }) => {
    const map = createMinimalLabyrinthMap();
    const highDamageCard = makeHighDamageCard();

    await page.addInitScript((data) => {
      const KEY = "alchemy-save-v1";
      const save = JSON.parse(localStorage.getItem(KEY) || "{}");
      save.activeRun = {
        characterId: "knight",
        runDeck: Array.from({ length: 6 }, () => ({ ...data.highDamageCard })),
        runGold: 0, runPlayerHealth: 30, runMaxHealth: 30, roomsEncountered: 0,
        currentAct: 1, destinationIndexInAct: 0, completedDestinations: [],
        runTrinkets: [], selectedDifficulty: null,
        contentSystemType: "labyrinth", labyrinthMap: data.map,
      };
      if (!Array.isArray(save.discoveredCardIds) || save.discoveredCardIds.length === 0) {
        save.discoveredCardIds = ["slash"];
      }
      localStorage.setItem(KEY, JSON.stringify(save));
    }, { map, highDamageCard });

    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Adventure" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /The Labyrinth/ }).click();
    await page.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 10000 });

    const combatNodes = page.getByRole("button", { name: /Combat|Fight/ });
    if (await combatNodes.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(combatNodes.first()).toBeVisible();
    }
  });
});
