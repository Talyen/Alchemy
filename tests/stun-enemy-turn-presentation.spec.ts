import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeStatusCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { slow } from "./playwright-tags";

test.describe("Stunned enemy turn presentation", slow, () => {
  test("stunned enemy shows Enemy Turn and draws hand without a flash", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = failOnRuntimeErrors(page);
    const flyingCards = page.locator("[data-flying-card]");
    const enemyTurn = page.getByTestId("turn-badge-enemy");
    const yourTurn = page.getByTestId("turn-badge-player");

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeStatusCard("stun", 12)),
    );
    const battle = new BattlePage(page);

    await expect(page.locator('[aria-label^="Play "]:not(.opacity-0)')).toHaveCount(4, { timeout: 20_000 });
    await expect(yourTurn).toHaveAttribute("data-active", "true");
    await battle.playCardNamed("Slash");
    await expect(battle.hand).toHaveCount(3, { timeout: 15_000 });
    await expect.poll(async () => battle.enemyHealth(), { timeout: 5000 }).toBeGreaterThan(0);

    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 5000 });

    const sawDiscardFly = expect
      .poll(async () => flyingCards.count(), {
        timeout: 10_000,
        message: "discard should animate with flying cards",
      })
      .toBeGreaterThan(0);
    await battle.endTurnBtn.click();
    await sawDiscardFly;

    await expect(enemyTurn).toHaveAttribute("data-active", "true", { timeout: 15_000 });
    await expect
      .poll(
        async () => battle.hand.evaluateAll((els) => els.filter((el) => getComputedStyle(el).opacity !== "0").length),
        { timeout: 8000 },
      )
      .toBe(0);

    await expect(yourTurn).toHaveAttribute("data-active", "true", { timeout: 20_000 });
    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 20_000 });
    expect(await battle.handCount()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
});
