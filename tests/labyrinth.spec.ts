import { test, expect } from "@playwright/test";
import { selectGameMode } from "./helpers";

test.describe("Labyrinth Mode", () => {
  test("full Labyrinth initialization and map progression", async ({ page }) => {
    // 1. Labyrinth button navigates to Character Select
    await page.goto("/");
    await selectGameMode(page, "labyrinth");
    await expect(page.getByRole("heading", { name: "Choose Your Hero" })).toBeVisible({ timeout: 5000 });

    // 2. Selecting character shows Labyrinth map screen
    await page.getByRole("button", { name: "Knight" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Choose your path through the depths")).toBeVisible();

    // 3. Verify entrance and first connected choice nodes are visible
    await expect(page.getByRole("button", { name: /Entrance chamber/ })).toBeVisible();
    const combatChamberNode = page.getByRole("button", { name: /Combat chamber.*enterable/ }).first();
    await expect(combatChamberNode).toBeVisible();

    // 4. Click first connected node to enter battle
    await combatChamberNode.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
  });
});
