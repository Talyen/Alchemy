import { expect } from "@playwright/test";
import { injectTalentUnlocks, makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

type TalentCase = {
  id: string;
  category: string;
  description: string;
  run: (page: import("@playwright/test").Page, battle: BattlePage) => Promise<void>;
};

const TALENT_CASES: TalentCase[] = [
  {
    id: "block-start",
    category: "block",
    description: "gives starting block in combat",
    run: async (page, _battle) => {
      await expect(page.getByRole("button", { name: "Block 5" })).toBeVisible({ timeout: 3000 });
    },
  },
  {
    id: "physical-brute-force",
    category: "physical",
    description: "increases physical damage dealt",
    run: async (page, battle) => {
      const enemyHpBefore = await battle.enemyHealth();
      await battle.playCardNamed("Slash");
      await expect(async () => {
        expect(await battle.enemyHealth()).toBeLessThan(enemyHpBefore - 6);
      }).toPass({ timeout: 5000 });
    },
  },
];

test.describe("Talents in Battle", () => {
  for (const tc of TALENT_CASES) {
    test(`${tc.id} ${tc.description}`, async ({ page, fastBattle }) => {
      void fastBattle;
      await injectTalentUnlocks(page, { [tc.category]: [tc.id] });
      await startBattleWithDeck(
        page,
        Array.from({ length: 8 }, () => makeCard()),
      );
      await tc.run(page, new BattlePage(page));
    });
  }
});
