import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";

test(
  "autoplay spends Mana and resolves both hand cards without pointer plays",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    const cards = Array.from({ length: 2 }, () =>
      makeCard({
        id: "block",
        cost: 1,
        effects: [{ kind: "player-status", status: "block", amount: 5 }],
      }),
    );
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand: cards,
        mana: 2,
        maxMana: 2,
        appliesFightPacing: false,
      }),
      { runDeck: cards, autoEndTurn: false },
    );
    const battle = new BattlePage(page);
    await battle.autoplayToggle.click();
    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "true");
    await expect(battle.hand).toHaveCount(0);
    await expect.poll(() => battle.mana()).toBe(0);
    await expect.poll(() => battle.block()).toBe(10);
    await expect(battle.endTurnBtn).toBeEnabled();
    await battle.autoplayToggle.click();
    await expect(battle.autoplayToggle).toHaveAttribute("aria-pressed", "false");
  },
);
