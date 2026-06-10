import { expect } from "@playwright/test";
import { makeStatusCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { critical } from "./playwright-tags";

const DOT_STATUS_CASES = [
  {
    name: "burn ticks each turn and halves",
    damageType: "burn",
    amount: 7,
    chipVisibleAfterTick: true,
  },
  {
    name: "poison ticks each turn and decays by 1",
    damageType: "poison",
    amount: 5,
    chipVisibleAfterTick: false,
  },
  {
    name: "bleed bursts on tick and resets to 0",
    damageType: "bleed",
    amount: 3,
    chipVisibleAfterTick: false,
    chipGoneAfterTick: true,
  },
] as const;

const CC_STATUS_CASES = [
  { name: "stun triggers CC causing enemy to skip turn", damageType: "stun", amount: 25 },
  { name: "freeze triggers CC causing enemy to skip turn", damageType: "freeze", amount: 25 },
] as const;

test.describe("Damage-over-Time Status Effects", critical, () => {
  for (const statusCase of DOT_STATUS_CASES) {
    test(statusCase.name, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      const title = statusCase.damageType.charAt(0).toUpperCase() + statusCase.damageType.slice(1);
      await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard(statusCase.damageType, statusCase.amount)));
      const battle = new BattlePage(page);

      await battle.playCardNamed(title);
      await expect(battle.statusChip(title)).toBeVisible({ timeout: 2000 });

      const enemyHpBefore = await battle.enemyHealth();
      await battle.endTurn();

      await expect(async () => {
        expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
      }).toPass({ timeout: 5000 });

      if ("chipGoneAfterTick" in statusCase && statusCase.chipGoneAfterTick) {
        await expect(battle.statusChip(title)).not.toBeVisible();
      } else if (statusCase.chipVisibleAfterTick) {
        await expect(battle.statusChip(title)).toBeVisible();
      }
    });
  }
});

test.describe("Crowd Control Status Effects", critical, () => {
  for (const statusCase of CC_STATUS_CASES) {
    test(statusCase.name, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      const title = statusCase.damageType.charAt(0).toUpperCase() + statusCase.damageType.slice(1);
      await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeStatusCard(statusCase.damageType, statusCase.amount)));
      const battle = new BattlePage(page);

      const playerHpBefore = await battle.playerHealth();
      await battle.playCardNamed(title);

      await battle.endTurn();
      await expect(async () => {
        expect(await battle.playerHealth()).toBe(playerHpBefore);
      }).toPass({ timeout: 5000 });
    });
  }
});
