// E2e tests for the Labyrinth node-map mode.
import { test, expect } from "@playwright/test";
import { injectSaveState, resumeGameMode, selectGameMode } from "./helpers";

test.describe("Labyrinth Mode", () => {
  test("Labyrinth button navigates to Character Select", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting character shows labyrinth map screen", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    // The map heading and subtext appear
    await expect(page.getByText("Choose your path through the depths")).toBeVisible();
  });

  test("labyrinth map shows entrance and first connected choice", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: /Entrance chamber/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Combat chamber.*enterable/ }).first()).toBeVisible();
  });

  test("clicking first connected node in labyrinth enters a battle", async ({ page }) => {
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Combat chamber.*enterable/ }).first().click();
    // Battle should start — playable cards appear
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("defeat in labyrinth returns to map (not game over)", async ({ page }) => {
    // Resume a real labyrinth save; starting a fresh Labyrinth run resets Health to max.
    await injectSaveState(page, {
      characterId: "knight",
      runPlayerHealth: 1,
      runMaxHealth: 30,
      contentSystemType: "labyrinth",
      labyrinthMap: minimalLabyrinthMap(),
    });
    await page.goto("/");
    await resumeGameMode(page, "labyrinth");
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: /Combat chamber.*enterable/ }).first().click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
    // End turn to let the enemy kill us. Death's Door may trigger first.
    await page.getByRole("button", { name: "End Turn" }).click();
    await page.waitForTimeout(2000);
    const endTurnBtn = page.getByRole("button", { name: "End Turn" });
    if (await endTurnBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await endTurnBtn.click();
    }
    // Should return to labyrinth map, NOT game over
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 15000 });
    // Game over heading should NOT appear
    await expect(page.getByRole("heading", { name: /Defeat/ })).not.toBeVisible({ timeout: 2000 });
  });
});

function minimalLabyrinthMap() {
  const emptyRow = () => [null, null, null, null, null, null, null, null, null];
  const grid = [emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()];
  grid[0][4] = {
    type: "entrance",
    modifiers: [],
    rewardModifiers: [],
    connections: [{ row: 1, col: 4 }],
    state: "current",
  };
  grid[1][4] = {
    type: "combat",
    modifiers: ["armored"],
    rewardModifiers: [],
    connections: [{ row: 0, col: 4 }],
    state: "visible",
  };
  return { grid, rows: 8, cols: 9, currentNode: { row: 0, col: 4 } };
}
