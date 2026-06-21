import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck, WOLF_COMPANION_CARD } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

type TrinketCase = {
  id: string;
  description: string;
  deck: Record<string, unknown>[];
  run: (page: import("@playwright/test").Page, battle: BattlePage) => Promise<void>;
};

const TRINKET_CASES: TrinketCase[] = [
  {
    id: "tattered-pages",
    description: "loads without runtime errors",
    deck: Array.from({ length: 6 }, () => makeCard()),
    run: async (_page, battle) => {
      expect(await battle.handCount()).toBeGreaterThan(0);
    },
  },
  {
    id: "companions-collar",
    description: "bonus applies to companion attacks",
    deck: Array.from({ length: 6 }, () => WOLF_COMPANION_CARD),
    run: async (_page, battle) => {
      await battle.playCardNamed("Wolf");
      await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
      const enemyHpBefore = await battle.enemyHealth();
      await battle.endTurn();
      await expect(async () => {
        expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore);
      }).toPass({ timeout: 5000 });
    },
  },
  {
    id: "brass-censer",
    description: "doubles first holy damage",
    deck: Array.from(
      { length: 6 },
      () =>
        makeCard({
          id: "test-holy",
          title: "Holy Strike",
          cost: 0,
          effects: [{ kind: "damage", damageType: "holy", amount: 5 }],
        }) as Record<string, unknown>,
    ),
    run: async (_page, battle) => {
      const enemyHpBefore = await battle.enemyHealth();
      await battle.playCardNamed("Holy Strike");
      await expect(async () => {
        expect(await battle.enemyHealth()).toBe(enemyHpBefore - 10);
      }).toPass({ timeout: 3000 });
    },
  },
];

test.describe("Trinket Effects in Battle", () => {
  for (const tc of TRINKET_CASES) {
    test(`${tc.id}: ${tc.description}`, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await startBattleWithDeck(page, tc.deck, { runTrinkets: [tc.id] });
      const battle = new BattlePage(page);
      await tc.run(page, battle);
    });
  }
});
