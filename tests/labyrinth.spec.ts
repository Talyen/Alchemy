import { test, expect } from "@playwright/test";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Labyrinth Mode", critical, () => {
  test("full Labyrinth initialization and map progression", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goToCharacterSelectUnlocked("labyrinth", { finishedRunCharacters: ["knight", "rogue"] });

    await menu.selectCharacterAndContinue("Knight");
    await expect(page.getByRole("heading", { name: "Labyrinth" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Choose your path through the depths")).toBeVisible();
    await menu.stage.expectRunPhase("runLoop");

    await expect(page.getByRole("button", { name: /Entrance chamber/ })).toBeVisible();
    const combatChamberNode = page.getByRole("button", { name: /Combat chamber.*enterable/ }).first();
    await expect(combatChamberNode).toBeVisible();

    await combatChamberNode.click();
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });
    await menu.stage.expectRunPhase("battle");
  });
});
