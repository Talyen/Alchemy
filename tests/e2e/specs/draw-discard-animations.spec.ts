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
        { timeout: 20_000, message: "the opening hand should transfer from the draw pile" },
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
    await page.evaluate((openingDrawCount) => {
      const testWindow = window as Window & { consecutivePlayAttempt?: { drawStarts: number; drawEnds: number } };
      const observer = new MutationObserver(() => {
        const drawStarts = performance.getEntriesByName("alchemy:battle:draw-start", "mark").length;
        const drawEnds = performance.getEntriesByName("alchemy:battle:draw-end", "mark").length;
        if (drawStarts !== openingDrawCount + 1 || drawEnds !== openingDrawCount) return;
        const card = document.querySelector<HTMLButtonElement>(
          '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "][aria-disabled="false"]',
        );
        if (!card) return;
        observer.disconnect();
        testWindow.consecutivePlayAttempt = { drawStarts, drawEnds };
        card.click();
      });
      observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    }, before);
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

  test("discard artwork lands exactly over the pile's muted-gem top card", async ({ page }) => {
    test.setTimeout(60_000);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    await waitForOpeningDeal(page);
    const battle = new BattlePage(page);
    const landing = page.evaluate(async () => {
      const selector = '[data-flying-card][data-transfer-kind="discard"]';
      const card = await new Promise<HTMLElement>((resolve) => {
        const observer = new MutationObserver(() => {
          const element = document.querySelector<HTMLElement>(selector);
          if (element) {
            observer.disconnect();
            resolve(element);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
      const back = card.querySelector<HTMLElement>("[data-discard-card-back]")!;
      const anchor = document.querySelector<HTMLElement>('[data-testid="discard-pile"] [data-pile-top-card]')!;
      const pileImage = document.querySelector<HTMLImageElement>('[data-testid="discard-pile"] img')!;
      const sameArtwork = back.querySelector<HTMLImageElement>("img")!.src === pileImage.src;
      let error = Infinity;
      let samples = 0;
      while (card.isConnected) {
        await new Promise(requestAnimationFrame);
        if (!card.isConnected) break;
        const actual = back.getBoundingClientRect();
        const target = anchor.getBoundingClientRect();
        error = Math.max(
          Math.abs(actual.x - target.x),
          Math.abs(actual.y - target.y),
          Math.abs(actual.width - target.width),
          Math.abs(actual.height - target.height),
        );
        samples++;
      }
      return { sameArtwork, error, samples };
    });
    const ending = battle.endTurn();
    await expect(page.locator('[data-flying-card][data-transfer-kind="discard"]')).toHaveCount(1);
    const result = await landing;
    expect(result.sameArtwork).toBe(true);
    expect(result.samples).toBeGreaterThan(2);
    expect(result.error).toBeLessThan(1);
    await ending;
    await expect(page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]')).toHaveCount(4);
  });

  test("playable hand cards stay colored during discard and draw transfers", async ({ page }) => {
    test.setTimeout(60_000);

    const flyingCards = page.locator("[data-flying-card]");
    const visibleHandCards = page.locator('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]');

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
    await page.getByRole("button", { name: "Confirm", exact: true }).click();

    await expect
      .poll(
        async () => {
          if ((await flyingCards.count()) === 0) return false;
          const classes = await visibleHandCards.evaluateAll((cards) => cards.map((card) => card.className));
          return classes.length > 0 && classes.every((className) => !className.includes("hand-card-unplayable"));
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
  });
});
