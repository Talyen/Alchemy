import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, injectActiveBattle, makeCard, makeGoblinBattleState } from "../../helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";

test.describe("Combat feedback animations", slow, () => {
  test.setTimeout(60_000);

  for (const side of ["player", "enemy"] as const) {
    test(`${side} feedback appears during the wind-up`, async ({ page }, testInfo) => {
      const errors = failOnRuntimeErrors(page);
      const hand = [makeCard({ cost: 0 })];
      await injectActiveBattle(page, makeGoblinBattleState({ hand }), { runDeck: hand, autoEndTurn: false });
      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Combat text animation" })).toHaveCount(0);
      await page.evaluate(() => {
        const measuredWindow = window as Window & { combatElapsed?: number };
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-testid="combat-text"]')) return;
          const lunge = document.querySelector(".animate-attack-lunge");
          const animation = lunge
            ?.getAnimations()
            .find((item) => item instanceof CSSAnimation && item.animationName === "combatant-attack-lunge");
          measuredWindow.combatElapsed = Number(animation?.currentTime ?? 0);
          observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      if (side === "player") await battle.playFirstCard();
      else await battle.endTurnBtn.click();
      await expect(page.getByTestId("combat-text").first()).toBeVisible();
      const elapsed = await page.evaluate(() => (window as Window & { combatElapsed?: number }).combatElapsed);
      await testInfo.attach(`${side}-feedback-timing`, {
        body: JSON.stringify({ elapsed }),
        contentType: "application/json",
      });
      expect(elapsed).toBeLessThan(114);
      expect(errors).toEqual([]);
    });
  }
});
