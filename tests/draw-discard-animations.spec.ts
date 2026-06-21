import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";

test.describe("Draw/discard animation invariants (1920×1080)", () => {
  test("play card shows ghost overlay", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    const ghostOverlays = page.locator(".card-ghost-overlay");

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await battle.playFirstCard();
    await expect(ghostOverlays.first()).toBeVisible({ timeout: 5000 });
    expect(errors).toEqual([]);
  });

  test("end turn shows ghost overlays during transition", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = failOnRuntimeErrors(page);
    const ghostOverlays = page.locator(".card-ghost-overlay");

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await battle.playFirstCard();

    const endTurnDone = battle.endTurn();
    const ghostsDuringTurn = expect
      .poll(async () => ghostOverlays.count(), {
        timeout: 20_000,
        message: "draw/discard ghosts should appear during the turn transition",
      })
      .toBeGreaterThan(0);
    await Promise.all([ghostsDuringTurn, endTurnDone]);
    expect(errors).toEqual([]);
  });

  test("all hand cards are enabled after draw", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await battle.playFirstCard();
    await battle.endTurn();

    const count = await battle.handCount();
    expect(count).toBeGreaterThan(0);
    await Promise.all(
      Array.from({ length: count }, (_, i) => expect(battle.hand.nth(i)).toBeEnabled({ timeout: 2000 })),
    );
    expect(errors).toEqual([]);
  });
});


