import { expect, test } from "../../fixtures/e2e";
import { makeStatusCard, startBattleWithDeck } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow, critical } from "../../playwright-tags";
import { observeDuringAction } from "../observe-during-action";

test(
  "stunned enemy shows Enemy Turn and draws hand without a flash",
  { tag: [critical.tag, slow.tag] },
  async ({ page }) => {
    test.setTimeout(process.env.CI ? 0 : 60_000);
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeStatusCard("stun", 12)),
    );
    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(4);
    await expect(page.getByTestId("turn-badge-player")).toHaveAttribute("data-active", "true");
    // The cards can be visible before the opening draw releases playback.
    await expect(battle.endTurnBtn).toBeEnabled();
    await battle.playCardNamed("Slash");
    await expect(battle.hand).toHaveCount(3);
    expect(await battle.enemyHealth()).toBeGreaterThan(0);
    await expect(battle.endTurnBtn).toBeEnabled();

    // Arm before input: both the discard flight and the stunned enemy's badge can
    // finish between Playwright round trips. Keep observing until the player returns.
    const observation = await page.evaluateHandle(() => {
      const handCounts: number[] = [];
      let sawDiscard = false;
      let sawEnemyTurn = false;
      let observer: MutationObserver;
      const result = new Promise<{ handCounts: number[]; sawDiscard: boolean; sawEnemyTurn: boolean }>((resolve) => {
        const record = () => {
          sawDiscard ||= document.querySelector("[data-flying-card]") !== null;
          sawEnemyTurn ||=
            document.querySelector('[data-testid="turn-badge-enemy"]')?.getAttribute("data-active") === "true";
          const playerTurn =
            document.querySelector('[data-testid="turn-badge-player"]')?.getAttribute("data-active") === "true";
          if (!playerTurn) {
            const count = document.querySelectorAll(
              '[data-hand-slot]:not([data-hand-hidden]) [aria-label^="Play "]',
            ).length;
            if (handCounts.at(-1) !== count) handCounts.push(count);
          } else if (sawEnemyTurn) {
            observer.disconnect();
            resolve({ handCounts, sawDiscard, sawEnemyTurn });
          }
        };
        observer = new MutationObserver(record);
        observer.observe(document, {
          attributes: true,
          attributeFilter: ["data-hand-hidden", "data-active"],
          childList: true,
          subtree: true,
        });
        record();
      });
      return { result, cancel: () => observer.disconnect() };
    });
    const { handCounts, sawDiscard, sawEnemyTurn } = await observeDuringAction(observation, () => battle.endTurn());
    expect(sawDiscard, "discard flight was never observed").toBe(true);
    expect(sawEnemyTurn, "stunned enemy turn was never presented").toBe(true);
    const firstEmpty = handCounts.indexOf(0);
    expect(firstEmpty, JSON.stringify(handCounts)).toBeGreaterThanOrEqual(0);
    expect(
      handCounts.slice(firstEmpty).every((count) => count === 0),
      JSON.stringify(handCounts),
    ).toBe(true);
    await expect(battle.hand).toHaveCount(4);
    await expect(battle.endTurnBtn).toBeEnabled();
  },
);
