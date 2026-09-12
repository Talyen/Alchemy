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
      expect(elapsed).toBeLessThan(114);
    });
  }
});

for (const { width, height, size, reducedMotion } of [
  { width: 1280, height: 720, size: 120, reducedMotion: false },
  { width: 1920, height: 1080, size: 100, reducedMotion: false },
  { width: 2560, height: 1080, size: 80, reducedMotion: true },
]) {
  test(
    `grouped bursts retain original styling at ${width}/${size}% (reduced motion=${reducedMotion})`,
    slow,
    async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
      await page.addInitScript((gameSizePercent) => {
        localStorage.setItem(
          "alchemy-device-display-v1",
          JSON.stringify({ version: 1, gameSizePercent, tooltipSizePercent: 100 }),
        );
      }, size);
      const hand = Array.from({ length: 4 }, () =>
        makeCard({
          cost: 0,
          effects: [
            { kind: "damage", damageType: "physical", amount: 4 },
            { kind: "damage", damageType: "physical", amount: 2 },
            { kind: "damage", damageType: "burn", amount: 2 },
            { kind: "damage", damageType: "poison", amount: 2 },
            { kind: "damage", damageType: "bleed", amount: 1 },
            { kind: "heal", amount: 4 },
            { kind: "player-status", status: "block", amount: 3 },
            { kind: "restore-mana", amount: 1 },
            { kind: "gain-gold", amount: 3 },
          ],
        }),
      );
      await injectActiveBattle(
        page,
        makeGoblinBattleState({
          hand,
          mana: 0,
          maxMana: 10,
          playerHealth: 10,
          playerMaxHealth: 100,
          enemyHealth: 1000,
          enemyMaxHealth: 1000,
          appliesFightPacing: false,
        }),
        { runDeck: hand, autoEndTurn: false, selectedAspectRatio: width > 2000 ? "ultrawide" : "desktop" },
      );
      const battle = new BattlePage(page);
      await expect(battle.hand).toHaveCount(4);
      await battle.playFirstCard();
      const enemyBursts = page.locator('[data-testid="combat-text-burst"][data-target="enemy"]');
      const playerBursts = page.locator('[data-testid="combat-text-burst"][data-target="player"]');
      await expect(enemyBursts).toHaveCount(1);
      const styling = await enemyBursts.first().evaluate((burst) => {
        const layer = burst.closest('[data-testid="combat-text-layer"]')! as HTMLElement;
        const entry = burst.querySelector('[data-testid="combat-text"]')!;
        const icon = entry.querySelector("svg")!;
        const layerRect = layer.getBoundingClientRect();
        const stageScale = layerRect.width / layer.offsetWidth;
        const contentScale = Number.parseFloat(getComputedStyle(entry).getPropertyValue("--content-scale")) || 1;
        return {
          fontSize: Number.parseFloat(getComputedStyle(entry).fontSize),
          iconSize: Number.parseFloat(getComputedStyle(icon).width),
          expectedFont: 37.8 * contentScale,
          expectedIcon: 35.532 * contentScale,
          top: burst.getBoundingClientRect().top,
          expectedTop:
            layerRect.top +
            layerRect.height / 2 -
            3 * Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * stageScale,
        };
      });
      expect(styling.fontSize).toBeCloseTo(styling.expectedFont, 1);
      expect(styling.iconSize).toBeCloseTo(styling.expectedIcon, 1);
      expect(Math.abs(styling.top - styling.expectedTop)).toBeLessThan(2);
      const originalId = await enemyBursts.first().getAttribute("data-burst-id");
      const originalTexts = await enemyBursts.first().getByTestId("combat-text").allTextContents();
      await expect(enemyBursts.first().locator('[data-stat="physical"]')).toHaveCount(1);
      await expect(enemyBursts.first().getByTestId("combat-text")).toHaveCount(4);
      await expect(playerBursts.first().getByTestId("combat-text")).toHaveCount(4);
      // Keyboard activation intentionally plays during hand reflow, without waiting for pointer stability.
      await battle.hand.first().press("Enter");
      await expect(enemyBursts).toHaveCount(2);
      await expect(playerBursts).toHaveCount(2);
      const ids = await enemyBursts.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-burst-id")));
      expect(ids[0]).toBe(originalId);
      expect(ids[1]).not.toBe(originalId);
      await expect(enemyBursts.first().getByTestId("combat-text")).toHaveText(originalTexts);
      await battle.hand.first().press("Enter");
      await expect(enemyBursts).toHaveCount(3);
      await expect(playerBursts).toHaveCount(3);
      const textZ = await page
        .getByTestId("combat-text-layer")
        .first()
        .evaluate((node) => Number(getComputedStyle(node).zIndex));
      const flightZ = await page
        .locator(".card-ghost-overlay")
        .evaluateAll((nodes) => nodes.map((node) => Number(getComputedStyle(node).zIndex)));
      expect(flightZ.every((z) => textZ > z)).toBe(true);
      await testInfo.attach("typed-bursts", { body: await page.screenshot(), contentType: "image/png" });
      if (reducedMotion) {
        const transforms = await enemyBursts.evaluateAll((nodes) =>
          nodes.map((node) => getComputedStyle(node.firstElementChild!).transform),
        );
        expect(transforms.every((transform) => transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)")).toBe(
          true,
        );
      }
      await expect(page.getByTestId("combat-text-burst")).toHaveCount(0, { timeout: 3000 });
    },
  );
}
