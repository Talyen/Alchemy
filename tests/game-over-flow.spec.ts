import { expect, test } from "@playwright/test";
import { enableFastMode, makeCard, startAtDestination, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

test.describe("Game Over via End Run", critical, () => {
  test("ending a run shows defeat screen and return to menu works", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Death's Door", () => {
  test("fire and heal saves player", async ({ page }) => {
    const LIFE_SAVING_BREAD = { id: "bread", title: "Bread", descriptionLines: ["Gain 30 Health", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "heal", amount: 30 }] };

    await enableFastMode(page);
    await startAtDestination(page, {
      runPlayerHealth: 1,
      runMaxHealth: 30,
      runDeck: [LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD],
    }, { forceDestination: "Normal Combat" });

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    await expect(combatBtn).toBeVisible({ timeout: 5000 });
    await combatBtn.click();

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const battle = new BattlePage(page);

    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 3000 });

    await battle.endTurn();
    await expect(page.getByLabel("Death's Door")).toBeVisible({ timeout: 3000 });

    const breadInHand = page.getByRole("button", { name: "Play Bread" }).first();
    await expect(breadInHand).toBeEnabled({ timeout: 2000 });
    await breadInHand.click();

    await battle.skipCombatBtn.click();
    await expect(battle.victoryHeading).toBeVisible({ timeout: 3000 });
  });
});
