import { expect } from "@playwright/test";
import { startBattleWithDeck, WOLF_COMPANION_CARD, makeCard, boxesOverlap } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { test } from "../../fixtures/e2e";
import { critical } from "../../playwright-tags";

test.describe("Companion Battle Behavior", () => {
  const COMPANION_DECK = Array.from({ length: 6 }, () => WOLF_COMPANION_CARD);

  test("summon companion card places companion in battle panel", async ({ page, fastBattle }) => {
    void fastBattle;

    await startBattleWithDeck(page, COMPANION_DECK);
    const battle = new BattlePage(page);

    await battle.playCardNamed("Wolf");
    await expect(battle.companionPanel).toBeVisible({ timeout: 3000 });
    await expect(battle.companionPanel).toHaveAttribute("aria-label", "Active companion: Wolf Companion");

    await expect(async () => {
      const companionBox = await battle.companionPanel.boundingBox();
      const healthBox = await battle.playerHealthPanel.boundingBox();
      expect(companionBox && healthBox).toBeTruthy();
      if (!companionBox || !healthBox) return;
      expect(boxesOverlap(companionBox, healthBox)).toBe(false);
    }).toPass();
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

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => blockCard),
    );
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
