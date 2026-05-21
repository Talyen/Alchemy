import { expect, test } from "@playwright/test";
import { startAtDestination, startCampaignBattle } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Game Over via End Run", () => {
  test("ending a run shows defeat screen and return to menu works", async ({ page }) => {
    await startCampaignBattle(page);
    const battle = new BattlePage(page);
    await battle.menuBtn.click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible();
    await page.getByRole("button", { name: "Return to Main Menu" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  });
});

test.describe("Death's Door", () => {
  test("fire and heal saves player", async ({ page }) => {
    const BREAD = { id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "heal", amount: 5 }] };
    const LIFE_SAVING_BREAD = { ...BREAD, descriptionLines: ["Gain 30 Health", "Consume"], effects: [{ kind: "heal", amount: 30 }] };

    await startAtDestination(page, {
      runPlayerHealth: 1,
      runMaxHealth: 30,
      runDeck: [LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, LIFE_SAVING_BREAD],
    }, { forceDestination: "Normal Combat" });

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    await expect(combatBtn).toBeVisible({ timeout: 5000 });
    await combatBtn.click();

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const battle = new BattlePage(page);

    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 5000 });

    await battle.endTurn();
    await expect(page.getByLabel("Death's Door")).toBeVisible({ timeout: 3000 });

    await expect(page.getByText("Death's Door")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Defeat" })).not.toBeVisible({ timeout: 1000 });

    const breadInHand = page.getByRole("button", { name: "Play Bread" }).first();
    await expect(breadInHand).toBeEnabled({ timeout: 3000 });
    await breadInHand.click();

    await battle.endTurn();
    await expect(page.getByRole("heading", { name: "Defeat" })).not.toBeVisible({ timeout: 2000 });
  });
});
