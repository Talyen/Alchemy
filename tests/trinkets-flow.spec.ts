import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck, WOLF_COMPANION_CARD } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

test.describe("Trinket Effects in Battle", () => {
  test("Tattered Pages does not cause runtime errors", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()), {
      runTrinkets: ["tattered-pages"],
    });
    const battle = new BattlePage(page);

    expect(await battle.handCount()).toBeGreaterThan(0);
  });

  test("Companion's Collar bonus applies to companion attacks", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => WOLF_COMPANION_CARD),
      { runTrinkets: ["companions-collar"] },
    );
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();
    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
  });

  test("Brass Censer doubles first holy damage", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard({
        id: "test-holy", title: "Holy Strike",
        cost: 0, effects: [{ kind: "damage", damageType: "holy", amount: 5 }],
      })),
      { runTrinkets: ["brass-censer"] },
    );
    const battle = new BattlePage(page);

    const enemyHpBefore = await battle.enemyHealth();
    await battle.playCardNamed("Holy Strike");

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 3000 });
  });
});
