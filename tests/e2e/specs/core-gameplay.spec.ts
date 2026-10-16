import { expect } from "@playwright/test";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";

import { critical } from "../../playwright-tags";

test.describe("Battle Autoplay", critical, () => {
  test("plays a hand card without clicking it", async ({ page, fastBattle }) => {
    void fastBattle;

    const blockCard = makeCard({
      id: "block",
      title: "Block",
      descriptionLines: ["Gain 5 Block"],
      effects: [{ kind: "player-status", status: "block", amount: 5 }],
    });

    const deck = Array.from({ length: 6 }, () => blockCard);
    await injectActiveBattle(page, makeGoblinBattleState({ hand: deck.slice(0, 4), deck: deck.slice(4) }), {
      runDeck: deck,
    });
    const battle = new BattlePage(page);
    await expect(battle.autoplayToggle).toBeVisible({ timeout: 10_000 });
    const manaBefore = await battle.mana();

    await battle.autoplayToggle.click();
    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "true");

    await expect
      .poll(async () => {
        if (!(await battle.manaPanel.isVisible())) return false;
        const mana = await battle.mana();
        const block = await battle.block();
        return mana < manaBefore || block > 0;
      })
      .toBe(true);
  });
});
