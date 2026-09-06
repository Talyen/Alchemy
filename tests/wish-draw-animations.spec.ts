import type { BattleCard } from "@/lib/game-data";
import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, injectActiveBattle, makeCard, makeGoblinBattleState } from "./helpers";
import { BattlePage } from "./pages/battle-page";

for (const wishFirst of [true, false]) {
  test(`Draw finishes before Wish choices with Wish ${wishFirst ? "first" : "last"}`, async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    const effects: BattleCard["effects"] = [
      { kind: "wish", amount: 2 },
      { kind: "draw-cards", amount: 2 },
    ];
    const hand = [makeCard({ cost: 0, effects: wishFirst ? effects : effects.toReversed() })];
    await injectActiveBattle(page, makeGoblinBattleState({ hand, deck: [makeCard(), makeCard()] }), { runDeck: hand });
    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(1);
    await page.evaluate(() => {
      const testWindow = window as Window & { wishDrawOverlap?: boolean };
      testWindow.wishDrawOverlap = false;
      const sample = () => {
        const choicesOpen = document.querySelector(".wish-overlay-backdrop:not(.screen-fade-out)");
        if (choicesOpen && document.querySelector("[data-flying-card]")) testWindow.wishDrawOverlap = true;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await battle.playFirstCard();
    const flyingCards = page.locator("[data-flying-card]");
    const activeOverlay = page.locator(".wish-overlay-backdrop:not(.screen-fade-out)");
    await expect(flyingCards.first()).toBeVisible();
    await expect(activeOverlay).toHaveCount(0);
    await expect(activeOverlay).toBeVisible();
    await expect(flyingCards).toHaveCount(0);
    await expect(battle.hand).toHaveCount(2);
    await activeOverlay
      .getByRole("button", { name: /^Choose / })
      .first()
      .click();
    await expect(flyingCards.first()).toBeVisible();
    await expect(activeOverlay).toHaveCount(0);
    await expect(activeOverlay).toBeVisible();
    await expect(flyingCards).toHaveCount(0);
    await expect(battle.hand).toHaveCount(3);
    await activeOverlay
      .getByRole("button", { name: /^Choose / })
      .first()
      .click();
    await expect(page.locator(".wish-overlay-panel")).toBeHidden();
    expect(await page.evaluate(() => (window as Window & { wishDrawOverlap?: boolean }).wishDrawOverlap)).toBe(false);
    expect(errors).toEqual([]);
  });
}
