import { expect, test } from "../../fixtures/e2e";
import { makeStatusCard, startBattleWithDeck } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow, critical } from "../../playwright-tags";

test.describe("Stunned enemy turn presentation", { tag: [critical.tag, slow.tag] }, () => {
  test("stunned enemy shows Enemy Turn and draws hand without a flash", async ({ page }) => {
    test.setTimeout(60_000);

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

    // Sample the hand through the whole discard → enemy badge → player badge
    // transition. Polling only after the badge settles cannot see a one-frame
    // flash (the regression this journey protects).
    await page.evaluate(() => {
      const testWindow = window as Window & {
        enemyTurnHandCounts?: number[];
        enemyTurnSeen?: boolean;
        discardFlightSeen?: boolean;
      };
      testWindow.enemyTurnHandCounts = [];
      let lastCount: number | null = null;
      const record = () => {
        testWindow.enemyTurnSeen ||=
          document.querySelector('[data-testid="turn-badge-enemy"]')?.getAttribute("data-active") === "true";
        testWindow.discardFlightSeen ||= !!document.querySelector('[data-flying-card][data-transfer-kind="discard"]');
        if (document.querySelector('[data-testid="turn-badge-player"]')?.getAttribute("data-active") === "true") return;
        const count = document.querySelectorAll(
          '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]',
        ).length;
        if (count !== lastCount) {
          lastCount = count;
          testWindow.enemyTurnHandCounts?.push(count);
        }
      };
      const observer = new MutationObserver(record);
      observer.observe(document, {
        attributes: true,
        attributeFilter: ["data-hand-hidden", "data-active"],
        childList: true,
        subtree: true,
      });
      (testWindow as Window & { enemyTurnHandObserver?: MutationObserver }).enemyTurnHandObserver = observer;
      record();
    });

    await battle.endTurnBtn.click();
    await expect
      .poll(() => page.evaluate(() => (window as Window & { enemyTurnSeen?: boolean }).enemyTurnSeen))
      .toBe(true);
    await expect(yourTurn).toHaveAttribute("data-active", "true", { timeout: 20_000 });
    const observed = await page.evaluate(() => {
      const testWindow = window as Window & {
        enemyTurnHandCounts?: number[];
        enemyTurnHandObserver?: MutationObserver;
        discardFlightSeen?: boolean;
      };
      testWindow.enemyTurnHandObserver?.disconnect();
      return {
        handCounts: testWindow.enemyTurnHandCounts ?? [],
        discardFlightSeen: testWindow.discardFlightSeen,
      };
    });
    expect(observed.discardFlightSeen).toBe(true);
    const { handCounts } = observed;
    const firstEmptySample = handCounts.indexOf(0);
    expect(firstEmptySample).toBeGreaterThanOrEqual(0);
    expect(handCounts.slice(firstEmptySample).every((count) => count === 0)).toBe(true);
    await expect(battle.endTurnBtn).toBeEnabled({ timeout: 20_000 });
    await battle.waitForOpeningHand();
  });
});
