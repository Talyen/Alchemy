import { injectActiveBattle } from "../../tests/e2e/save-injection";
import { makeGoblinBattleState } from "../../tests/fixtures/battle-state";
import { authoredCards, largeRunDeck } from "../scenario-data";
import { waitForBattleReady } from "../battle-setup";
import { runMeasuredEndTurn } from "../battle-helpers";
import { BattlePage } from "../../tests/pages/battle-page";
import { expect, test } from "../fixtures";

test.describe("combat-feedback-burst", () => {
  test("authored cards and simultaneous damage-over-time feedback", async ({ measureScenario }) => {
    let peakTexts = 0;
    let peakBursts = 0;
    await measureScenario({
      scenario: "combat-feedback-burst",
      profile: "continuous",
      minFrames: 300,
      segments: [{ name: "feedback-overlap", minActions: 4, minFrames: 60 }],
      collectObservations: async () => ({
        peakConcurrentTexts: peakTexts,
        peakConcurrentBursts: peakBursts,
        fixtureHandCards: 7,
        fixtureDeckCards: 60,
      }),
      setup: async (page) => {
        peakTexts = 0;
        peakBursts = 0;
        const hand = authoredCards([
          "pixie-dust",
          "sunburst",
          "holy-radiance",
          "caustic-jab",
          "ray-of-frost",
          "block",
          "phoenix-feather",
        ]);
        const deck = largeRunDeck().slice(7);
        await injectActiveBattle(
          page,
          makeGoblinBattleState({
            hand,
            deck,
            playerHealth: 25,
            playerStatuses: { burn: 1, poison: 1, bleed: 1 },
            enemyStatuses: { burn: 1, poison: 1, bleed: 1 },
          }),
          { runDeck: [...hand, ...deck], autoEndTurn: false },
        );
        await waitForBattleReady(page);
        await expect(page.locator('[aria-label^="Play "]')).toHaveCount(7);
        // Observe inside the renderer before input; protocol polling can miss short-lived bursts.
        await page.evaluate(() => {
          const stats = { texts: 0, bursts: 0 };
          const visibleCount = (testId: string) =>
            Array.from(document.querySelectorAll(`[data-testid="${testId}"]`)).filter((element) =>
              element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
            ).length;
          let frame = 0;
          const sample = () => {
            stats.texts = Math.max(stats.texts, visibleCount("combat-text"));
            stats.bursts = Math.max(stats.bursts, visibleCount("combat-text-burst"));
            frame = requestAnimationFrame(sample);
          };
          frame = requestAnimationFrame(sample);
          (window as unknown as { __feedbackPeak: () => typeof stats }).__feedbackPeak = () => {
            cancelAnimationFrame(frame);
            return stats;
          };
        });
      },
      interact: async (page, phase, recordAction) => {
        const battle = new BattlePage(page);
        for (const title of ["Pixie Dust", "Sunburst", "Holy Radiance", "Caustic Jab"]) {
          await phase("feedback-overlap");
          await expect(battle.endTurnBtn).toBeEnabled();
          const card = page.getByRole("button", { name: `Play ${title}`, exact: true });
          const slot = card.locator("xpath=ancestor::*[@data-hand-slot]");
          const key = await slot.getAttribute("data-hand-slot");
          const bounds = await slot.boundingBox();
          if (!bounds) throw new Error(`No hand slot for ${title}`);
          // A full hand overlaps artwork. The pointer owner resolves the nearest
          // untransformed slot, so send real input to that slot's center.
          await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          await expect(page.locator(`[data-hand-slot=${JSON.stringify(key)}]`)).toHaveCount(0);
          await recordAction(`play:${title}`);
        }
        await expect(page.getByTestId("combat-text")).toHaveCount(0, { timeout: 10_000 });
        await runMeasuredEndTurn(page, battle, phase);
        await expect(page.getByTestId("combat-text")).toHaveCount(0, { timeout: 10_000 });
        const peaks = await page.evaluate(() =>
          (window as unknown as { __feedbackPeak: () => { texts: number; bursts: number } }).__feedbackPeak(),
        );
        peakTexts = peaks.texts;
        peakBursts = peaks.bursts;
        expect(peakTexts).toBeGreaterThanOrEqual(6);
        expect(peakBursts).toBeGreaterThanOrEqual(2);
      },
    });
  });
});
