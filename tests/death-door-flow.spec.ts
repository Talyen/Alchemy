import { expect } from "@playwright/test";
import { makeCard, startAtDestination, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

test.describe("Death's Door", critical, () => {
  test("lethal damage after grace expires shows defeat screen", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
      {
        runPlayerHealth: 1,
        runMaxHealth: 30,
      },
    );
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(page.getByRole("heading", { name: "Defeat" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible({ timeout: 5000 });
  });

  test("heal from Death's Door saves player and victory resolves", async ({ page, fastBattle }) => {
    void fastBattle;

    const LIFE_SAVING_BREAD = {
      id: "bread",
      title: "Bread",
      descriptionLines: ["Gain 30 Health", "Deal massive Burn damage", "Consume"],
      art: "placeholder",
      cost: 0,
      consume: true,
      effects: [
        { kind: "heal", amount: 30 },
        { kind: "damage", damageType: "burn", amount: 500 },
      ],
    };

    await startAtDestination(
      page,
      {
        runPlayerHealth: 1,
        runMaxHealth: 30,
        runDeck: Array.from({ length: 6 }, () => ({ ...LIFE_SAVING_BREAD })),
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
    await expect(battle.victoryHeading).toBeVisible({ timeout: 5000 });
  });

  test("Death's Door icon persists across consecutive end turns while at 1 HP", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
      {
        runPlayerHealth: 1,
        runMaxHealth: 30,
      },
    );
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });

    await battle.playFirstCard();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });
  });

  test("non-lethal damage while in Death's Door stays at 0 HP", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
      {
        runPlayerHealth: 1,
        runMaxHealth: 30,
      },
    );
    const battle = new BattlePage(page);

    await battle.endTurn();
    await expect(battle.deathsDoorIcon).toBeVisible({ timeout: 3000 });

    await expect.poll(() => battle.playerHealth()).toBe(0);
  });
});
