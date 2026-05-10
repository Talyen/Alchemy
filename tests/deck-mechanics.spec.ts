import { expect, test } from "@playwright/test";
import { startRun } from "./helpers";

function parseCount(value: string | null): number {
  return value ? Number(value) : 0;
}

test.describe("Deck Mechanics", () => {
  test("non-consume card increments discard pile on play", async ({ page }) => {
    await startRun(page);

    // Knight's non-consume cards: Slash, Bash, Block, Anvil, Plate Mail
    const nonConsume = page.locator('[aria-label^="Play "]:not([aria-label*="Bread"])');
    if ((await nonConsume.count()) === 0) {
      test.skip(true, "No non-consume card in initial hand");
      return;
    }

    const discardBefore = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));

    await nonConsume.first().click();
    await page.waitForTimeout(500);

    const discardAfter = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));
    expect(discardAfter).toBe(discardBefore + 1);
  });

  test("consume card exhausts instead of going to discard", async ({ page }) => {
    await startRun(page);

    const breadCard = page.getByRole("button", { name: "Play Bread" });
    if (!(await breadCard.isVisible({ timeout: 500 }).catch(() => false))) {
      test.skip(true, "Bread not in initial hand");
      return;
    }

    const discardBefore = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));

    await breadCard.click();
    await page.waitForTimeout(500);

    const discardAfter = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));
    expect(discardAfter).toBe(discardBefore);
  });

  test("draw pile reshuffles from discard when exhausted", async ({ page }) => {
    await startRun(page);

    // Knight deck: 6 cards, draw 4/turn.
    // Turn 1: draw 4 (deck→2). Play 1, end turn → hand(3)→discard. Deck=2, Discard=4.
    // Turn 2: draw 2 (deck→0). Play 1, end turn → hand(1)→discard. Deck=0, Discard=6.
    // Turn 3: draw from empty → reshuffle → discard→deck, draw 4.

    for (let turn = 0; turn < 2; turn++) {
      const playable = page.locator('[aria-label^="Play "]');
      if ((await playable.count()) > 0) {
        await playable.first().click();
        await page.waitForTimeout(220);
      }
      await page.getByRole("button", { name: "End Turn" }).click();
      await expect(page.getByRole("button", { name: "End Turn" })).toBeEnabled({ timeout: 8000 });
    }

    const victoryVisible = await page.getByRole("heading", { name: /^Victory/ }).isVisible().catch(() => false);
    if (victoryVisible) {
      test.skip(true, "Enemy died before reshuffle");
      return;
    }

    const discardCount = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));
    const drawCount = parseCount(await page.getByTestId("draw-pile").getAttribute("data-count"));

    // After reshuffle: discard emptied into deck, deck has cards
    expect(discardCount).toBe(0);
    expect(drawCount).toBeGreaterThan(0);
  });
});
