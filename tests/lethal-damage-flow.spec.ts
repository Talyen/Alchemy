import { expect, test } from "@playwright/test";
import { enableFastMode, makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Lethal Battle Defeat", () => {
  test.describe.configure({ mode: "serial" });
  test("lethal damage after Death's Door grace expires shows defeat screen", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()), {
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible({ timeout: 3000 });
  });

  test("defeat from menu ends run immediately", async ({ page }) => {
    await enableFastMode(page);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    await battle.menuBtn.click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Return to Main Menu" })).toBeVisible({ timeout: 3000 });
  });
});
