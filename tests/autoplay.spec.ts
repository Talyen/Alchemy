import { expect } from "@playwright/test";
import { makeCard, startBattleWithDeck } from "./helpers";
import { test } from "./fixtures/e2e";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

test.describe("Battle Autoplay", critical, () => {
  test("plays a hand card without clicking it", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);
    await expect(battle.autoplayToggle).toBeVisible();
    const manaBefore = await battle.mana();
    const enemyBefore = await battle.enemyHealth();

    await battle.autoplayToggle.click();
    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(async () => {
        const mana = await battle.mana();
        const enemy = await battle.enemyHealth();
        return mana < manaBefore || enemy < enemyBefore;
      })
      .toBe(true);
  });
});
