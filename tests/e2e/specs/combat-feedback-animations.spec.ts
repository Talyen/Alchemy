import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";

test.describe("Combat feedback animations", slow, () => {
  test.setTimeout(60_000);

  test("combat text stays pinned as the portrait moves through an attack", async ({ page }) => {
    const hand = [
      makeCard({
        cost: 0,
        effects: [
          { kind: "damage", damageType: "physical", amount: 1 },
          { kind: "heal", amount: 1 },
        ],
      }),
    ];
    await injectActiveBattle(page, makeGoblinBattleState({ hand, playerHealth: 10, playerMaxHealth: 100 }), {
      runDeck: hand,
      autoEndTurn: false,
    });
    const battle = new BattlePage(page);
    await battle.playFirstCard();
    const burst = page.locator('[data-testid="combat-text-burst"][data-target="player"]');
    await expect(burst).toBeVisible();
    const samples = await burst.evaluate(async (node) => {
      const layer = node.closest('[data-testid="combat-text-layer"]')!;
      const portrait = document.querySelector('[data-testid="battle-player-art-panel"]')!;
      const lunge = portrait.closest('[data-testid="combatant-attack-lunge"]')!;
      const animation = lunge
        .getAnimations()
        .find((item) => item instanceof CSSAnimation && item.animationName === "combatant-attack-lunge")!;
      animation.pause();
      const samples = [];
      for (const time of [0, 114, 228, 650]) {
        animation.currentTime = time;
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        const anchor = portrait.getBoundingClientRect();
        const overlay = layer.getBoundingClientRect();
        samples.push({
          x: anchor.x,
          error: Math.max(
            Math.abs(anchor.x - overlay.x),
            Math.abs(anchor.y - overlay.y),
            Math.abs(anchor.width - overlay.width),
            Math.abs(anchor.height - overlay.height),
          ),
        });
      }
      animation.play();
      return samples;
    });
    expect(
      Math.max(...samples.map((sample) => sample.x)) - Math.min(...samples.map((sample) => sample.x)),
    ).toBeGreaterThan(10);
    expect(samples.every((sample) => sample.error < 2)).toBe(true);
    await expect(burst).toHaveCount(0);
  });

  test("combat text follows the portrait when stun presentation mounts during a burst", async ({ page }) => {
    const hand = [
      makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "physical", amount: 1 }] }),
      makeCard({ cost: 0, effects: [{ kind: "damage", damageType: "stun", amount: 20 }] }),
    ];
    await injectActiveBattle(page, makeGoblinBattleState({ hand, enemyHealth: 40, enemyMaxHealth: 40 }), {
      runDeck: hand,
      autoEndTurn: false,
    });
    const battle = new BattlePage(page);
    await battle.playFirstCard();

    const burst = page.locator('[data-testid="combat-text-burst"][data-target="enemy"]').first();
    await expect(burst).toBeVisible();
    await battle.hand.first().press("Enter");
    await expect(page.getByTestId("combatant-status-effect")).toBeVisible();

    await expect
      .poll(
        async () =>
          burst.evaluate((node) => {
            const layer = node.closest('[data-testid="combat-text-layer"]')!;
            const portrait = document.querySelector('[data-testid="battle-enemy-art-panel"]')!;
            const anchor = portrait.getBoundingClientRect();
            const overlay = layer.getBoundingClientRect();
            return Math.max(
              Math.abs(anchor.x - overlay.x),
              Math.abs(anchor.y - overlay.y),
              Math.abs(anchor.width - overlay.width),
              Math.abs(anchor.height - overlay.height),
            );
          }),
        { intervals: [16], timeout: 2000 },
      )
      .toBeLessThan(2);
  });

  for (const side of ["player", "enemy"] as const) {
    test(`${side} feedback appears during the wind-up`, async ({ page }, testInfo) => {
      const hand = [makeCard({ cost: 0 })];
      await injectActiveBattle(page, makeGoblinBattleState({ hand }), { runDeck: hand, autoEndTurn: false });
      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Combat text animation" })).toHaveCount(0);
      await page.evaluate(() => {
        const measuredWindow = window as Window & { combatElapsed?: number };
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[data-testid="combat-text"]')) return;
          const lunge = document.querySelector(".animate-attack-lunge");
          const animation = lunge
            ?.getAnimations()
            .find((item) => item instanceof CSSAnimation && item.animationName === "combatant-attack-lunge");
          measuredWindow.combatElapsed = Number(animation?.currentTime ?? 0);
          observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      if (side === "player") await battle.playFirstCard();
      else await battle.endTurnBtn.click();
      await expect(page.getByTestId("combat-text").first()).toBeVisible();
      const elapsed = await page.evaluate(() => (window as Window & { combatElapsed?: number }).combatElapsed);
      await testInfo.attach(`${side}-feedback-timing`, {
        body: JSON.stringify({ elapsed }),
        contentType: "application/json",
      });
      expect(elapsed).toBeLessThan(170);
    });
  }
});

for (const reducedMotion of [false, true]) {
  test(`rapid cards consolidate feedback (reduced motion=${reducedMotion})`, slow, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    const hand = Array.from({ length: 3 }, () =>
      makeCard({
        cost: 0,
        effects: [
          { kind: "damage", damageType: "physical", amount: 3 },
          { kind: "player-status", status: "block", amount: 2 },
        ],
      }),
    );
    await injectActiveBattle(
      page,
      makeGoblinBattleState({ hand, enemyHealth: 1000, enemyMaxHealth: 1000, appliesFightPacing: false }),
      { runDeck: hand, autoEndTurn: false },
    );
    const battle = new BattlePage(page);
    await expect(battle.hand).toHaveCount(3);
    await battle.waitForOpeningHand();
    await battle.playFirstCard();
    const player = page.locator('[data-testid="combat-text-burst"][data-target="player"]');
    const block = player.locator('[data-stat="block"]');
    await expect(block).toHaveText("+2");
    const id = await player.getAttribute("data-burst-id");
    const started = Number(await player.getAttribute("data-first-shown-at"));
    // Freeze Date only: leave animation frames and interaction clocks running normally.
    await page.clock.setFixedTime(started + 100);
    await battle.hand.first().press("Enter");
    await expect(player).toHaveCount(1);
    await expect(player).toHaveAttribute("data-burst-id", id!);
    await expect(block).toHaveText("+4");
    await expect(page.locator('[data-testid="combat-text-burst"][data-target="enemy"]')).toHaveCount(1);
    const labels = await page.getByTestId("combat-text").allTextContents();
    expect(labels.every((text) => /^[+−-]?\d+$/.test(text.trim()))).toBe(true);
  });
}
