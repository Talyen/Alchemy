import { expect, test } from "../../fixtures/e2e";
import { makeCard, seedRandom, startBattleWithDeck } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
type TransferWindow = Window & {
  transferReview: {
    phase: "opening" | "play" | "turn";
    openingCounts: number[];
    openingFlight: boolean;
    openingBlocked: boolean;
    playBlocked: boolean;
    discardColored: boolean;
    grayscale: string[];
    discard: {
      maximumFlights: number;
      flips: number[];
      backs: boolean;
      landing: Box;
      pile?: Box;
    } | null;
  };
  stopTransferReview: () => void;
};

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
  test("deals, gates inspection, and transfers a playable hand through a real turn", async ({ page }) => {
    test.setTimeout(60_000);
    await seedRandom(page, 42);
    // Observe before boot/input: protocol assertions can miss a whole transfer.
    await page.addInitScript(() => {
      const state = window as TransferWindow;
      const review = (state.transferReview = {
        phase: "opening",
        openingCounts: [],
        openingFlight: false,
        openingBlocked: false,
        playBlocked: false,
        discardColored: false,
        grayscale: [],
        discard: null,
      } as TransferWindow["transferReview"]);
      const box = (element: Element): Box => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      const record = () => {
        if (!document.querySelector('[data-testid="battle-scene"]')) return;
        const cards = [...document.querySelectorAll('[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]')];
        const blocked =
          document.querySelector('[data-testid="draw-pile"] button')?.getAttribute("aria-disabled") === "true";
        if (review.phase === "opening") {
          if (review.openingCounts.at(-1) !== cards.length) review.openingCounts.push(cards.length);
          if (document.querySelector("[data-flying-card]")) {
            review.openingFlight = true;
            review.openingBlocked ||= blocked;
          }
          return;
        }
        if (review.phase === "play") review.playBlocked ||= blocked;
        const starts = performance.getEntriesByName("alchemy:battle:draw-start", "mark").length;
        const ends = performance.getEntriesByName("alchemy:battle:draw-end", "mark").length;
        if (starts > ends) {
          for (const card of cards.filter((card) => card.classList.contains("hand-card-unplayable")))
            review.grayscale.push(card.getAttribute("aria-label") ?? "unknown card");
        }
        const flight = document.querySelector<HTMLElement>('[data-flying-card][data-transfer-kind="discard"]');
        if (!flight) return;
        review.discardColored ||=
          cards.length > 0 && cards.every((card) => !card.classList.contains("hand-card-unplayable"));
        if (review.discard) return;
        const discard: NonNullable<TransferWindow["transferReview"]["discard"]> = (review.discard = {
          maximumFlights: 0,
          flips: [],
          backs: !!flight.querySelector("[data-discard-card-back]"),
          landing: box(flight),
        });
        const sample = () => {
          if (!flight.isConnected) {
            discard.pile = box(document.querySelector("[data-pile-top-card]")!);
            return;
          }
          discard.maximumFlights = Math.max(
            discard.maximumFlights,
            document.querySelectorAll('[data-flying-card][data-transfer-kind="discard"]').length,
          );
          discard.flips.push(Number(flight.style.transform.match(/rotateY\(([-\d.]+)deg\)/)?.[1] ?? 0));
          discard.landing = box(flight);
          requestAnimationFrame(sample);
        };
        sample();
      };
      const observer = new MutationObserver(record);
      observer.observe(document, {
        attributes: true,
        attributeFilter: ["data-hand-hidden", "aria-disabled", "class"],
        childList: true,
        subtree: true,
      });
      state.stopTransferReview = () => observer.disconnect();
    });
    await startBattleWithDeck(
      page,
      Array.from({ length: 8 }, () => makeCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] })),
      { autoEndTurn: false },
    );
    const battle = new BattlePage(page);
    const icon = page.getByTestId("draw-pile").getByRole("button");
    const dock = page.getByTestId("battle-hand");

    await test.step("opening deal starts empty and blocks pile inspection until ready", async () => {
      await waitForOpeningDeal(page);
      await expect(icon).toHaveAttribute("aria-disabled", "false");
      const opening = await page.evaluate(() => (window as TransferWindow).transferReview);
      expect(opening.openingCounts[0]).toBe(0);
      expect(opening.openingCounts).toContain(4);
      expect(opening.openingFlight).toBe(true);
      expect(opening.openingBlocked).toBe(true);
      const before = await dock.boundingBox();
      await icon.click();
      await expect(page.getByRole("dialog", { name: "Draw Pile", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      expect(await dock.boundingBox()).toEqual(before);
    });

    await test.step("playing a card temporarily gates inspection", async () => {
      await page.evaluate(() => ((window as TransferWindow).transferReview.phase = "play"));
      await battle.playFirstCard();
      await expect.poll(() => page.evaluate(() => (window as TransferWindow).transferReview.playBlocked)).toBe(true);
      await expect(icon).toHaveAttribute("aria-disabled", "false");
    });

    await test.step("discard flips sequentially onto its pile and the next deal stays colored", async () => {
      const before = await page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-end", "mark").length);
      await page.evaluate(() => ((window as TransferWindow).transferReview.phase = "turn"));
      await battle.endTurn();
      await expect
        .poll(() => page.evaluate(() => performance.getEntriesByName("alchemy:battle:draw-end", "mark").length))
        .toBe(before + 1);
      await expect(battle.hand).toHaveCount(4);
      await expect(icon).toHaveAttribute("aria-disabled", "false");
      await expect
        .poll(() => page.evaluate(() => (window as TransferWindow).transferReview.discard?.pile))
        .toBeTruthy();
      const review = await page.evaluate(() => {
        (window as TransferWindow).stopTransferReview();
        return (window as TransferWindow).transferReview;
      });
      expect(review.discardColored).toBe(true);
      expect(review.grayscale).toEqual([]);
      const discard = review.discard!;
      expect(discard.maximumFlights).toBe(1);
      expect(discard.backs).toBe(true);
      expect(discard.flips.length).toBeGreaterThan(3);
      expect(discard.flips.at(-1)).toBeCloseTo(180, 0);
      for (let i = 1; i < discard.flips.length; i++)
        expect(discard.flips[i]!).toBeGreaterThanOrEqual(discard.flips[i - 1]! - 0.1);
      for (const key of ["x", "y", "width", "height"] as const)
        expect(discard.landing[key]).toBeCloseTo(discard.pile![key], 0);
      await icon.click();
      await expect(page.getByRole("dialog", { name: "Draw Pile", exact: true })).toBeVisible();
    });
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
        const testWindow = window as Window & {
          consecutivePlayAttempt?: { drawStarts: number; drawEnds: number };
        };
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
});
