import { expect } from "@playwright/test";
import { startBattleWithDeck, WOLF_COMPANION_CARD } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

test.describe("Companion Battle Behavior", () => {
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    await expect(battle.companionPanel).toHaveAttribute("aria-label", "Active companion: Wolf Companion");
  });

  test("companion auto-attacks at start of owner turn", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    const enemyHpBefore = await battle.enemyHealth();
    await battle.endTurn();

    await expect(async () => {
      expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
    }).toPass({ timeout: 5000 });
  });

  test("companion persists across multiple turns", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });

    if ((await battle.handCount()) > 0) {
      await battle.playFirstCard();
    }
    await battle.endTurn();
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
  });
});
