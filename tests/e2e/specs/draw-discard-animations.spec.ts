import { expect, test } from "../../fixtures/e2e";
import { makeCard, startBattleWithDeck } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";

async function waitForOpeningDeal(page: import("@playwright/test").Page) {
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-end", "mark").length), {
      timeout: 20_000,
      message: "the opening hand deal should finish",
    })
    .toBeGreaterThan(0);
  await expect(page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]')).toHaveCount(4, {
    timeout: 20_000,
  });
}

test.describe("Draw/discard animation invariants (1920×1080)", slow, () => {
  test("battle mounts with an empty hand and deals the opening four", async ({ page }) => {
    test.setTimeout(60_000);

    await page.addInitScript(() => {
      const testWindow = window as Window & { openingFlyingCardSeen?: boolean; openingHandCounts?: number[] };
      testWindow.openingFlyingCardSeen = false;
      testWindow.openingHandCounts = [];
      const recordHand = () => {
        if (!document.querySelector('[data-testid="battle-scene"]')) return;
        const count = document.querySelectorAll(
          '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]',
        ).length;
        if (testWindow.openingHandCounts?.at(-1) !== count) testWindow.openingHandCounts?.push(count);
        if (document.querySelector("[data-flying-card]")) testWindow.openingFlyingCardSeen = true;
      };
      new MutationObserver(recordHand).observe(document, {
        attributes: true,
        attributeFilter: ["data-hand-hidden"],
        childList: true,
        subtree: true,
      });
    });

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battle = new BattlePage(page);
    await expect(page.getByRole("combobox", { name: "Card Animations · Temporary" })).toHaveCount(0);

    await expect
      .poll(
        () =>
          page.evaluate(() => (window as Window & { openingFlyingCardSeen?: boolean }).openingFlyingCardSeen ?? false),
        { timeout: 20_000, message: "the opening hand should fly from Draw Pile" },
      )
      .toBe(true);
    await expect(battle.hand).toHaveCount(4, { timeout: 20_000 });
    await expect(page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]')).toHaveCount(4, {
      timeout: 20_000,
    });
    const opening = await page.evaluate(() => {
      const testWindow = window as Window & { openingFlyingCardSeen?: boolean; openingHandCounts?: number[] };
      return { flyingCardSeen: testWindow.openingFlyingCardSeen, handCounts: testWindow.openingHandCounts ?? [] };
    });
    expect(opening.flyingCardSeen).toBe(true);
    const handCounts = opening.handCounts;
    expect(handCounts[0]).toBe(0);
    expect(handCounts).toContain(4);
  });

  test("accepts consecutive plays while draws and hand reflow are running", async ({ page }) => {
    test.setTimeout(60_000);

    await startBattleWithDeck(
      page,
      Array.from({ length: 12 }, () =>
        makeCard({
          cost: 0,
          effects: [
            { kind: "draw-cards", amount: 1 },
            { kind: "player-status", status: "block", amount: 1 },
          ],
        }),
      ),
    );
    await waitForOpeningDeal(page);
    const visibleCards = page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]');
    const drawStarts = () =>
      page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-start", "mark").length);
    const before = await drawStarts();
    const playedKey = await visibleCards
      .first()
      .evaluate((card) => card.closest("[data-hand-slot]")!.getAttribute("data-hand-slot"));
    await page.evaluate(
      ({ openingDrawCount, playedKey }) => {
        const testWindow = window as Window & { consecutivePlayAttempt?: { drawStarts: number; drawEnds: number } };
        const observer = new MutationObserver(() => {
          const drawStarts = performance.getEntriesByName("alchemy:battle:draw-start", "mark").length;
          const drawEnds = performance.getEntriesByName("alchemy:battle:draw-end", "mark").length;
          if (drawStarts !== openingDrawCount + 1 || drawEnds !== openingDrawCount) return;
          // Artwork can mutate before React replaces the played hand; never click its stale button again.
          if (
            [...document.querySelectorAll("[data-hand-slot]")].some(
              (slot) => slot.getAttribute("data-hand-slot") === playedKey,
            )
          )
            return;
          const card = document.querySelector<HTMLButtonElement>(
            '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "][aria-disabled="false"]',
          );
          if (!card) return;
          observer.disconnect();
          testWindow.consecutivePlayAttempt = { drawStarts, drawEnds };
          card.click();
        });
        observer.observe(document.body, { attributes: true, childList: true, subtree: true });
      },
      { openingDrawCount: before, playedKey },
    );
    const firstSlot = await page.locator("[data-hand-slot]:not([data-hand-hidden])").first().boundingBox();
    if (!firstSlot) throw new Error("Playable card has no hand slot");
    await page.mouse.click(firstSlot.x + firstSlot.width / 2, firstSlot.y + firstSlot.height / 2);
    await expect
      .poll(() => page.evaluate(() => (window as Window & { consecutivePlayAttempt?: unknown }).consecutivePlayAttempt))
      .toEqual({ drawStarts: before + 1, drawEnds: before });
    await expect.poll(drawStarts).toBe(before + 2);
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-end", "mark").length))
      .toBe(before + 2);
    const overlap = await page.evaluate(
      (openingDrawCount) => ({
        secondDrawStart: performance.getEntriesByName("alchemy:battle:draw-start", "mark")[openingDrawCount + 1]
          ?.startTime,
        firstDrawEnd: performance.getEntriesByName("alchemy:battle:draw-end", "mark")[openingDrawCount]?.startTime,
      }),
      before,
    );
    expect(overlap.secondDrawStart).toBeLessThan(overlap.firstDrawEnd!);
    await expect(visibleCards).toHaveCount(4);
  });

  test("discards flip onto the visible pile sequentially and retain hand styling", async ({ page }) => {
    test.setTimeout(60_000);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await waitForOpeningDeal(page);
    const battle = new BattlePage(page);
    const flight = page.evaluate(async () => {
      const card = await new Promise<HTMLElement>((resolve) => {
        const observer = new MutationObserver(() => {
          const element = document.querySelector<HTMLElement>('[data-flying-card][data-transfer-kind="discard"]');
          if (element) {
            observer.disconnect();
            resolve(element);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
      let maximumFlights = 0;
      const flips: number[] = [];
      let landing = { x: 0, y: 0, width: 0, height: 0 };
      while (card.isConnected) {
        maximumFlights = Math.max(
          maximumFlights,
          document.querySelectorAll('[data-flying-card][data-transfer-kind="discard"]').length,
        );
        flips.push(Number(card.style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1] ?? 0));
        const r = card.getBoundingClientRect();
        landing = { x: r.x, y: r.y, width: r.width, height: r.height };
        await new Promise(requestAnimationFrame);
      }
      const pile = document.querySelector("[data-pile-top-card]")!.getBoundingClientRect();
      return {
        maximumFlights,
        flips,
        landing,
        pile: { x: pile.x, y: pile.y, width: pile.width, height: pile.height },
        backs: !!card.querySelector("[data-discard-card-back]"),
      };
    });
    const ending = battle.endTurn();
    const result = await flight;
    expect(result.maximumFlights).toBe(1);
    expect(result.backs).toBe(true);
    expect(result.flips.length).toBeGreaterThan(3);
    expect(result.flips.at(-1)).toBeCloseTo(180, 0);
    for (let i = 1; i < result.flips.length; i++)
      expect(result.flips[i]!).toBeGreaterThanOrEqual(result.flips[i - 1]! - 0.1);
    for (const key of ["x", "y", "width", "height"] as const)
      expect(result.landing[key]).toBeCloseTo(result.pile[key], 0);
    await ending;
    await expect(page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]')).toHaveCount(4);
  });

  test("playable hand cards stay colored during discard and draw transfers", async ({ page }) => {
    test.setTimeout(60_000);

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
        discardColoredSeen?: boolean;
      };
      testWindow.drawGrayscaleFlashes = [];
      testWindow.discardColoredSeen = false;
      testWindow.cardColorObserver = new MutationObserver(() => {
        if (document.querySelector('[data-flying-card][data-transfer-kind="discard"]')) {
          const cards = [
            ...document.querySelectorAll('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]'),
          ];
          testWindow.discardColoredSeen ||=
            cards.length > 0 && cards.every((card) => !card.classList.contains("hand-card-unplayable"));
        }
        const drawStarts = performance.getEntriesByName("alchemy:battle:draw-start", "mark").length;
        const drawEnds = performance.getEntriesByName("alchemy:battle:draw-end", "mark").length;
        if (drawStarts <= drawEnds) return;
        document
          .querySelectorAll<HTMLElement>(
            '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "].hand-card-unplayable',
          )
          .forEach((card) => {
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
      .poll(() => page.evaluate(() => (window as Window & { discardColoredSeen?: boolean }).discardColoredSeen), {
        message: "affordable cards should stay colored during discard",
      })
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
        discardColoredSeen?: boolean;
      };
      testWindow.cardColorObserver?.disconnect();
      return testWindow.drawGrayscaleFlashes ?? [];
    });
    expect(drawGrayscaleFlashes).toEqual([]);
  });
});
