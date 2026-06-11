import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Lethal Battle Defeat", critical, () => {
  test("lethal damage after Death's Door grace expires shows defeat screen", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()), {
      runPlayerHealth: 1,
      runMaxHealth: 30,
    });
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
  });
});
