import { expect, test } from "@playwright/test";
import { injectSaveState, navigateToDestination, resumeGameMode, startRun } from "./helpers";

function parseCount(value: string | null): number {
  return value ? Number(value) : 0;
}

test.describe("Deck Mechanics", () => {
  test("non-consume card increments discard pile on play", async ({ page }) => {
    const SLASH = { id: "slash", title: "Slash", descriptionLines: ["Deal 6 Physical damage"], art: "placeholder", cost: 1, effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 6 }] };
    await injectSaveState(page, {
      runDeck: [SLASH, SLASH, SLASH, SLASH],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const discardBefore = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));

    await page.locator('[aria-label^="Play "]').first().click();
    await page.waitForTimeout(500);

    const discardAfter = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));
    expect(discardAfter).toBe(discardBefore + 1);
  });

  test("consume card exhausts instead of going to discard", async ({ page }) => {
    const BREAD = { id: "bread", title: "Bread", descriptionLines: ["Gain 5 Health", "Consume"], art: "placeholder", cost: 1, consume: true, effects: [{ kind: "heal" as const, amount: 5 }] };
    await injectSaveState(page, {
      runDeck: [BREAD, BREAD, BREAD, BREAD],
    });
    await page.goto("/");
    await resumeGameMode(page, "campaign");
    await expect(page.getByRole("heading", { name: "Choose Destination" })).toBeVisible({ timeout: 10000 });
    await navigateToDestination(page, "Normal Combat");
    await expect(page.locator('[aria-label^="Play "]').first()).toBeVisible({ timeout: 10000 });

    const discardBefore = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));

    await page.locator('[aria-label="Play Bread"]').first().click();
    await page.waitForTimeout(500);

    const discardAfter = parseCount(await page.getByTestId("discard-pile").getAttribute("data-count"));
    expect(discardAfter).toBe(discardBefore);
  });

  test("draw pile reshuffles from discard when exhausted", async ({ page }) => {
    await startRun(page);

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

    expect(discardCount).toBe(0);
    expect(drawCount).toBeGreaterThan(0);
  });
});
