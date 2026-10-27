import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";
import { observeDuringAction } from "../observe-during-action";

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
    // Autoplay also ends the turn, even when the separate auto-end setting is off.
    // Observe the completed plays before the next turn consumes their Block.
    const observation = await page.evaluateHandle(() => {
      let cancelled = false;
      const result = (async () => {
        const start = performance.now();
        while (!cancelled && performance.now() - start < 15_000) {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
          const mana = document.querySelector('[data-testid="mana-panel"]')?.getAttribute("data-mana");
          const block = document.querySelector('[aria-label="Block 10"]');
          const cards = document.querySelectorAll('[aria-label^="Play "]');
          if (mana === "0" && block && cards.length === 0) return true;
        }
        return false;
      })();
      return {
        result,
        cancel: () => {
          cancelled = true;
        },
      };
    });
    expect(await observeDuringAction(observation, () => battle.autoplayToggle.click())).toBe(true);
  },
);
