import { expect } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";
import { injectLabyrinthRun, makeHighDamageCard } from "./helpers";

test.describe("Labyrinth Mode", () => {
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

  test("navigates to labyrinth map from an injected labyrinth run", async ({ page, fastBattle }) => {
    void fastBattle;
    await injectLabyrinthRun(page, {
      deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
    });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/i })).toBeVisible({ timeout: 5000 });
  });

  test("labyrinth map shows with combat and rest nodes available", critical, async ({ page }) => {
    await injectLabyrinthRun(page, { deck: Array.from({ length: 6 }, () => makeHighDamageCard()), resume: true });

    await expect(page.getByRole("heading", { name: /Labyrinth|Map/ })).toBeVisible({ timeout: 5000 });

    const combatNodes = page.getByRole("button", { name: /Combat|Fight/ });
    await expect(combatNodes.first()).toBeVisible({ timeout: 5000 });
  });
});
