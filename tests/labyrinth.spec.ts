// E2e tests for the Labyrinth node-map mode.
import { test, expect } from "@playwright/test";
import { injectSaveState } from "./helpers";

test.describe("Labyrinth Mode", () => {
  test("Labyrinth button navigates to Character Select", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Labyrinth" }).click();
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });
  });

  test("selecting character shows labyrinth map screen", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Labyrinth" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    // The map heading and subtext appear
    await expect(page.getByText("Choose your path through the depths")).toBeVisible();
  });

  test("labyrinth map shows start node visible and clickable", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Labyrinth" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    // The start node is a combat node with "Combat" label and "⚔" or a Swords icon
    await expect(page.getByText("Combat").first()).toBeVisible();
  });

  test("clicking start node in labyrinth enters a battle", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Labyrinth" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    // Click the first visible node (start combat node)
    await page.getByText("Combat").first().click();
    // Battle should start — playable cards appear
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });
  });

  test("defeat in labyrinth returns to map (not game over)", async ({ page }) => {
    // Inject a labyrinth save with very low HP so we die quickly.
    await injectSaveState(page, {
      characterId: "knight",
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Labyrinth" }).click();
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    // Click the first combat node
    await page.getByText("Combat").first().click();
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
