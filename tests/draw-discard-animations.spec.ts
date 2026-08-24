import { expect, test } from "@playwright/test";
import { failOnRuntimeErrors, makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { slow } from "./playwright-tags";

async function waitForOpeningDeal(page: import("@playwright/test").Page) {
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-end", "mark").length), {
      timeout: 20_000,
      message: "the opening hand deal should finish",
    })
    .toBeGreaterThan(0);
  await expect(page.locator('[aria-label^="Play "]:not(.opacity-0)')).toHaveCount(4, { timeout: 20_000 });
}

test.describe("Draw/discard animation invariants (1920×1080)", slow, () => {
  test("battle mounts with an empty hand and deals the opening four", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = failOnRuntimeErrors(page);
    await page.addInitScript(() => {
      const testWindow = window as Window & { openingFlyingCardSeen?: boolean; openingHandCounts?: number[] };
      testWindow.openingFlyingCardSeen = false;
      testWindow.openingHandCounts = [];
      const recordHand = () => {
        if (!document.querySelector('[data-testid="battle-scene"]')) return;
        const count = document.querySelectorAll('[aria-label^="Play "]').length;
        if (testWindow.openingHandCounts?.at(-1) !== count) testWindow.openingHandCounts?.push(count);
        if (document.querySelector("[data-flying-card]")) testWindow.openingFlyingCardSeen = true;
      };
      new MutationObserver(recordHand).observe(document, { childList: true, subtree: true });
    });

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);

    await expect
      .poll(
        () =>
          page.evaluate(() => (window as Window & { openingFlyingCardSeen?: boolean }).openingFlyingCardSeen ?? false),
        { timeout: 20_000, message: "the opening hand should transfer from the draw pile" },
      )
      .toBe(true);
    await expect(battle.hand).toHaveCount(4, { timeout: 20_000 });
    await expect(page.locator('[aria-label^="Play "]:not(.opacity-0)')).toHaveCount(4, { timeout: 20_000 });
    const opening = await page.evaluate(() => {
      const testWindow = window as Window & { openingFlyingCardSeen?: boolean; openingHandCounts?: number[] };
      return { flyingCardSeen: testWindow.openingFlyingCardSeen, handCounts: testWindow.openingHandCounts ?? [] };
    });
    expect(opening.flyingCardSeen).toBe(true);
    const handCounts = opening.handCounts;
    expect(handCounts[0]).toBe(0);
    expect(handCounts).toContain(4);
    expect(errors).toEqual([]);
  });

  test("play card shows ghost overlay", async ({ page }) => {
    const errors = failOnRuntimeErrors(page);
    const ghostOverlays = page.locator(".card-ghost-overlay");

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);
    await waitForOpeningDeal(page);

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
    await waitForOpeningDeal(page);

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

  test("playable hand cards stay colored while discard and draw transfers block input", async ({ page }) => {
    test.setTimeout(60_000);
    const errors = failOnRuntimeErrors(page);
    const ghostOverlays = page.locator(".card-ghost-overlay");
    const visibleHandCards = page.locator('[aria-label^="Play "]:not(.opacity-0)');

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);
    await waitForOpeningDeal(page);
    const openingDrawStarts = await page.evaluate(
      () => performance.getEntriesByName("alchemy:battle:draw-start", "mark").length,
    );

    await page.evaluate(() => {
      const testWindow = window as Window & {
        cardColorObserver?: MutationObserver;
        drawGrayscaleFlashes?: string[];
      };
      testWindow.drawGrayscaleFlashes = [];
      testWindow.cardColorObserver = new MutationObserver(() => {
        const drawStarts = performance.getEntriesByName("alchemy:battle:draw-start", "mark").length;
        const drawEnds = performance.getEntriesByName("alchemy:battle:draw-end", "mark").length;
        if (drawStarts <= drawEnds) return;
        document.querySelectorAll<HTMLElement>('[aria-label^="Play "]:not(.opacity-0).grayscale').forEach((card) => {
          testWindow.drawGrayscaleFlashes?.push(card.getAttribute("aria-label") ?? "unknown card");
        });
      });
      testWindow.cardColorObserver.observe(document.body, {
        attributes: true,
        attributeFilter: ["class"],
        childList: true,
        subtree: true,
      });
    });

    await battle.playFirstCard();
    await expect(battle.endTurnBtn).toBeEnabled();
    await battle.endTurnBtn.click();

    await expect
      .poll(
        async () => {
          if ((await ghostOverlays.count()) === 0) return false;
          const classes = await visibleHandCards.evaluateAll((cards) => cards.map((card) => card.className));
          return classes.length > 0 && classes.every((className) => !className.includes("grayscale"));
        },
        { message: "affordable cards should stay colored during discard" },
      )
      .toBe(true);

    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-start", "mark").length), {
        timeout: 20_000,
        message: "the next hand draw should start",
      })
      .toBeGreaterThan(openingDrawStarts);

    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 20_000 });
    const drawGrayscaleFlashes = await page.evaluate(() => {
      const testWindow = window as Window & {
        cardColorObserver?: MutationObserver;
        drawGrayscaleFlashes?: string[];
      };
      testWindow.cardColorObserver?.disconnect();
      return testWindow.drawGrayscaleFlashes ?? [];
    });
    expect(drawGrayscaleFlashes).toEqual([]);
    expect(errors).toEqual([]);
  });
});
