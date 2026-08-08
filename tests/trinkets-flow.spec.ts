import { expect } from "@playwright/test";
import { startBattleWithDeck, WOLF_COMPANION_CARD, seedRandom } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";
import { slow } from "./playwright-tags";

interface TrinketCase {
  id: string;
  description: string;
  deck: Array<Record<string, unknown>>;
  run: (page: import("@playwright/test").Page, battle: BattlePage) => Promise<void>;
}

const TRINKET_CASES: TrinketCase[] = [
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
];

test.describe("Trinket Effects in Battle", slow, () => {
  for (const tc of TRINKET_CASES) {
    test(`${tc.id}: ${tc.description}`, async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;
      await seedRandom(page, 42);
      await startBattleWithDeck(page, tc.deck, { runTrinkets: [tc.id] });
      const battle = new BattlePage(page);
      await tc.run(page, battle);
    });
  }
});
