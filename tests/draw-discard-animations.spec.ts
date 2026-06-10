import { expect } from "@playwright/test";
import { makeCard, makeHighDamageCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { test } from "./fixtures/e2e";

test.describe("Draw/discard animation invariants (1920×1080)", () => {
  test("turn cycle animations and interaction boundaries function correctly", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    const ghostOverlays = page.locator(".card-ghost-overlay");

    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
    const battle = new BattlePage(page);

    await expect(battle.hand.first()).toBeVisible({ timeout: 5000 });
    await battle.playFirstCard();
    await expect(ghostOverlays.first()).toBeVisible({ timeout: 5000 });

    const endTurnDone = battle.endTurn();
    await expect
      .poll(async () => ghostOverlays.count(), {
        timeout: 8000,
        message: "draw/discard ghosts should appear during the turn transition",
      })
      .toBeGreaterThan(0);
    await endTurnDone;

    const count = await battle.handCount();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(battle.hand.nth(i)).toBeEnabled({ timeout: 1000 });
    }
  });
});

const ALT_RESOLUTIONS = [
  { width: 2560, height: 1080, label: "ultrawide" },
  { width: 1440, height: 900, label: "16:10" },
] as const;

for (const { width, height, label } of ALT_RESOLUTIONS) {
  test.describe(`Draw/discard at ${label}`, () => {
    test.use({ viewport: { width, height } });

    test("no errors and cards playable after draw", async ({ page, fastBattle, runtimeErrors }) => {
      void fastBattle;
      void runtimeErrors;

      await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeCard()));
      const count = await page.locator('[aria-label^="Play "]').count();
      expect(count).toBeGreaterThan(0);
    });
  });
}

test.describe("Draw/discard edge cases", () => {
  test("end turn during combat resolves without errors", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    test.setTimeout(60_000);
    await startBattleWithDeck(page, Array.from({ length: 6 }, () => makeHighDamageCard()));
    const battle = new BattlePage(page);

    await battle.endTurnBtn.click();
    await battle.winViaCombat(3);
  });
});
