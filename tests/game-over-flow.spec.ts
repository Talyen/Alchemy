import { expect } from "@playwright/test";
import {
  assertDefeatFromEndRun,
  makeCard,
  makeHighDamageCard,
  startAtDestination,
  startBattleWithDeck,
} from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Game Over via End Run", critical, () => {
  test("ending a run shows defeat screen and return to menu works", async ({ page, fastBattle }) => {
    test.setTimeout(60_000);
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await assertDefeatFromEndRun(page, { returnToMenu: true });
  });

  test("ending a run from destination screen shows defeat screen", async ({ page }) => {
    await startAtDestination(page, {});
    await page.getByRole("button", { name: "Open destination menu" }).click();
    await page.getByRole("button", { name: "End Run" }).click();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Death's Door", critical, () => {
  test("fire and heal saves player", async ({ page, fastBattle }) => {
    void fastBattle;

    const LIFE_SAVING_BREAD = {
      id: "bread",
      title: "Bread",
      descriptionLines: ["Gain 30 Health", "Consume"],
      art: "placeholder",
      cost: 1,
      consume: true,
      effects: [{ kind: "heal", amount: 30 }],
    };
    const finisher = makeHighDamageCard();

    await startAtDestination(
      page,
      {
        runPlayerHealth: 1,
        runMaxHealth: 30,
        runDeck: [LIFE_SAVING_BREAD, LIFE_SAVING_BREAD, finisher, finisher, finisher, finisher],
      },
      { forceDestination: "Normal Combat" },
    );

    const combatBtn = page.getByRole("button", { name: /Combat/ }).first();
    await expect(combatBtn).toBeVisible({ timeout: 5000 });
    await combatBtn.click();

    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 5000 });

    const battle = new BattlePage(page);

    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 3000 });

    await battle.endTurn();
    await expect(page.getByLabel("Death's Door")).toBeVisible({ timeout: 3000 });

    await battle.playCardNamed("Bread");

    await expect.poll(() => battle.playerHealth()).toBeGreaterThan(0);
    await battle.playCardNamed("Boss Killer");
    await expect(battle.victoryHeading).toBeVisible({ timeout: 5000 });
  });
});
