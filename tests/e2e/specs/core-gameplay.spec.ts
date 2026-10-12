import { expect } from "@playwright/test";
import { MAX_HAND_SIZE } from "@/lib/game-constants";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { test } from "../../fixtures/e2e";
import { BattlePage } from "../../pages/battle-page";

import { critical } from "../../playwright-tags";

test.describe("Battle Flow", () => {
  test("maximum hand remains visible beyond the battle scene boundary", async ({ page, fastBattle }) => {
    void fastBattle;
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand: Array.from({ length: MAX_HAND_SIZE }, () => makeCard()),
      }),
    );

    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(MAX_HAND_SIZE);
    await expect(battle.hand.first()).toBeVisible();
    await expect(battle.hand.last()).toBeVisible();

    const layout = await page.evaluate(() => {
      const scene = document.querySelector<HTMLElement>('[data-testid="battle-scene"]');
      const stage = document.querySelector<HTMLElement>('[data-testid="vr-stage"]');
      const cards = Array.from(document.querySelectorAll<HTMLElement>('[aria-label^="Play "]'));
      if (!scene || !stage) throw new Error("Battle layout roots are missing");

      const rect = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      };

      return {
        sceneOverflow: getComputedStyle(scene).overflow,
        scene: rect(scene),
        stage: rect(stage),
        cards: cards.map(rect),
      };
    });

    expect(layout.sceneOverflow).toBe("visible");
    expect(layout.cards.some((card) => card.bottom > layout.scene.bottom + 0.5)).toBe(true);
    expect(Math.max(...layout.cards.map((card) => card.bottom))).toBeLessThanOrEqual(layout.stage.bottom + 1);
  });
});

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
