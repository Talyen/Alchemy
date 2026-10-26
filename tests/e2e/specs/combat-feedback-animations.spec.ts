import { expect, test } from "../../fixtures/e2e";
import { injectActiveBattle, makeCard, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { translatedLabel } from "../localization";
import { slow } from "../../playwright-tags";
import type { JSHandle } from "@playwright/test";

async function observeDuringAction<T>(
  observation: JSHandle<{ result: Promise<T>; cancel: () => void }>,
  action: () => Promise<void>,
) {
  try {
    await action();
    return await observation.evaluate(async ({ result }) => result);
  } finally {
    await observation.evaluate(({ cancel }) => cancel());
    await observation.dispose();
  }
}

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
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand,
        playerHealth: 10,
        playerMaxHealth: 100,
        enemyHealth: 40,
        enemyMaxHealth: 40,
        enemyCC: { stunSkipTurns: 1 },
      }),
      {
        runDeck: hand,
        autoEndTurn: false,
        masterVolume: 0,
      },
    );
    const battle = new BattlePage(page);
    const burst = page.locator('[data-testid="combat-text-burst"][data-target="player"]');
    // Arm in the renderer before input: protocol round trips must not consume the burst's lifetime.
    const observation = await page.evaluateHandle(() => {
      let cancelled = false;
      const frame = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      const result = (async () => {
        let node: HTMLElement | null = null;
        while (!cancelled && !node) {
          node = document.querySelector('[data-testid="combat-text-burst"][data-target="player"]');
          if (!node) await frame();
        }
        if (!node) return { samples: [], healingText: null };
        const layer = node.closest('[data-testid="combat-text-layer"]')!;
        const portrait = document.querySelector('[data-testid="battle-player-art-panel"]')!;
        const lunge = portrait.closest('[data-testid="combatant-attack-lunge"]')!;
        const animation = lunge
          .getAnimations()
          .find((item) => item instanceof CSSAnimation && item.animationName === "combatant-attack-lunge");
        if (!animation) throw new Error("Attack lunge was missing when combat text appeared");
        animation.pause();
        const samples = [];
        try {
          while (node.isConnected && getComputedStyle(node).visibility !== "visible") await frame();
          for (const time of [0, 114, 228, 650]) {
            animation.currentTime = time;
            await frame();
            await frame();
            const anchor = portrait.getBoundingClientRect();
            const overlay = layer.getBoundingClientRect();
            samples.push({
              x: anchor.x,
              connected: node.isConnected,
              error: Math.max(
                Math.abs(anchor.x - overlay.x),
                Math.abs(anchor.y - overlay.y),
                Math.abs(anchor.width - overlay.width),
                Math.abs(anchor.height - overlay.height),
              ),
            });
          }
          return { samples, healingText: node.querySelector('[data-kind="heal"][data-stat="health"]')?.textContent };
        } finally {
          animation.play();
        }
      })();
      return {
        result,
        cancel: () => {
          cancelled = true;
        },
      };
    });
    const { samples, healingText } = await observeDuringAction(observation, () => battle.playFirstCard());
    expect(healingText).toContain("1");
    await expect.poll(() => battle.playerHealth()).toBe(11);
    await expect.poll(() => battle.enemyHealth()).toBe(39);
    expect(
      Math.max(...samples.map((sample) => sample.x)) - Math.min(...samples.map((sample) => sample.x)),
    ).toBeGreaterThan(10);
    expect(
      samples.every((sample) => sample.connected),
      JSON.stringify(samples),
    ).toBe(true);
    expect(Math.max(...samples.map((sample) => sample.error)), JSON.stringify(samples)).toBeLessThan(2);
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
    await expect(battle.hand.last()).toBeEnabled();
    const target = (await page.locator("[data-hand-slot]").last().boundingBox())!;
    const observation = await page.evaluateHandle(() => {
      let cancelled = false;
      const measured: { burst: Element | null; sawBeforeStun: boolean } = { burst: null, sawBeforeStun: false };
      const record = () => {
        measured.burst ??= document.querySelector('[data-testid="combat-text-burst"][data-target="enemy"]');
        measured.sawBeforeStun ||= Boolean(
          measured.burst &&
          !document
            .querySelector('[data-testid="battle-enemy-art-panel"]')
            ?.closest('[data-testid="combatant-status-effect"]'),
        );
      };
      const observer = new MutationObserver(record);
      observer.observe(document.body, { childList: true, subtree: true });
      const result = (async () => {
        while (!cancelled) {
          record();
          const { burst, sawBeforeStun } = measured;
          if (burst && !burst.isConnected) return { sawBeforeStun, connected: false, error: Infinity };
          const portrait = document.querySelector('[data-testid="battle-enemy-art-panel"]');
          const stunned = portrait?.closest('[data-testid="combatant-status-effect"]');
          if (burst && stunned && portrait) {
            const anchor = portrait.getBoundingClientRect();
            const overlay = burst.closest('[data-testid="combat-text-layer"]')!.getBoundingClientRect();
            const error = Math.max(
              Math.abs(anchor.x - overlay.x),
              Math.abs(anchor.y - overlay.y),
              Math.abs(anchor.width - overlay.width),
              Math.abs(anchor.height - overlay.height),
            );
            if (!burst.isConnected || error < 2) return { sawBeforeStun, connected: burst.isConnected, error };
          }
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        }
        return { sawBeforeStun: measured.sawBeforeStun, connected: false, error: Infinity };
      })();
      return {
        result,
        cancel: () => {
          cancelled = true;
          observer.disconnect();
        },
      };
    });
    const result = await observeDuringAction(observation, async () => {
      await battle.playFirstCard();
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    });
    expect(result.sawBeforeStun).toBe(true);
    expect(result.connected).toBe(true);
    expect(result.error).toBeLessThan(2);
  });

  for (const side of ["player", "enemy"] as const) {
    test(`${side} feedback appears during the wind-up`, async ({ page }) => {
      const hand = [makeCard({ cost: 0 })];
      await injectActiveBattle(
        page,
        makeGoblinBattleState({
          hand,
          currentEnemy: { id: "goblin", abilityIds: ["slash", "stab", "sunder"] },
        }),
        { runDeck: hand, autoEndTurn: false },
      );
      const battle = new BattlePage(page);
      await expect(battle.hand.first()).toBeVisible();
      const observation = await page.evaluateHandle((side) => {
        let cancelled = false;
        const result = (async () => {
          const deadline = performance.now() + 2000;
          while (!cancelled && performance.now() < deadline) {
            const target = side === "player" ? "enemy" : "player";
            const text = document.querySelector(
              `[data-testid="combat-text-burst"][data-target="${target}"] [data-testid="combat-text"]`,
            );
            if (text && getComputedStyle(text).visibility === "visible") {
              const animation = document
                .querySelector(`[data-testid="battle-${side}-art-panel"]`)
                ?.closest('[data-testid="combatant-attack-lunge"]')
                ?.getAnimations()
                .find((item) => item instanceof CSSAnimation && item.animationName === "combatant-attack-lunge");
              if (animation?.currentTime != null) return { visible: true, elapsed: Number(animation.currentTime) };
            }
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          }
          return { visible: false, elapsed: Infinity };
        })();
        return {
          result,
          cancel: () => {
            cancelled = true;
          },
        };
      }, side);
      const timing = await observeDuringAction(observation, async () => {
        if (side === "player") await battle.playFirstCard();
        else await battle.endTurn();
      });
      expect(timing.visible).toBe(true);
      expect(timing.elapsed, `${side} feedback needs a running attack lunge during wind-up`).toBeLessThan(170);
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
    const target = (await page.locator("[data-hand-slot]").last().boundingBox())!;
    const started = await page.evaluate(() => Date.now());
    // Freeze Date only: leave animation frames and interaction clocks running normally.
    await page.clock.setFixedTime(started);
    const observation = await page.evaluateHandle(() => {
      interface FirstBurst {
        id: string | null;
        block: string | null;
      }
      let first: FirstBurst | null = null;
      let observer: MutationObserver;
      const result = new Promise<{
        first: FirstBurst | null;
        id: string | null;
        players: number;
        enemies: number;
        labels: string[];
      }>((resolve) => {
        observer = new MutationObserver(() => {
          const players = document.querySelectorAll('[data-testid="combat-text-burst"][data-target="player"]');
          const player = players[0];
          const block = player?.querySelector('[data-stat="block"]')?.textContent ?? null;
          if (player && !first) first = { id: player.getAttribute("data-burst-id"), block };
          if (player && block === "+4") {
            resolve({
              first,
              id: player.getAttribute("data-burst-id"),
              players: players.length,
              enemies: document.querySelectorAll('[data-testid="combat-text-burst"][data-target="enemy"]').length,
              labels: [...document.querySelectorAll('[data-testid="combat-text"]')].map(
                (node) => node.textContent ?? "",
              ),
            });
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      });
      return { result, cancel: () => observer.disconnect() };
    });
    const review = await observeDuringAction(observation, async () => {
      await battle.playFirstCard();
      await page.clock.setFixedTime(started + 100);
      await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
    });
    expect(review.first?.block).toBe("+2");
    expect(review.id).toBe(review.first?.id);
    expect(review.players).toBe(1);
    expect(review.enemies).toBe(1);
    expect(review.labels.every((text) => /^[+−-]?\d+$/.test(text.trim()))).toBe(true);
  });
}

for (const reducedMotion of [false, true]) {
  test(
    `translated queued reactions stay single-line and finish promptly (reduced motion=${reducedMotion})`,
    slow,
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
      await page.addInitScript(() => localStorage.setItem("alchemy-language-v1", "ru"));
      const hand = [
        makeCard({
          id: "slash",
          cost: 0,
          effects: [
            { kind: "damage", damageType: "burn", amount: 4 },
            { kind: "damage", damageType: "physical", amount: 6 },
            { kind: "damage", damageType: "nature", amount: 4 },
          ],
        }),
      ];
      await injectActiveBattle(
        page,
        makeGoblinBattleState({
          hand,
          enemyHealth: 300,
          enemyMaxHealth: 300,
          appliesFightPacing: false,
          enemyStatuses: { poison: 12 },
          enemyCC: { freezeSkipTurns: 2 },
          reactions: { shatterDamage: 8, frostfireDamage: 8, wildfireDamage: 3 },
        }),
        { runDeck: hand, autoEndTurn: false, masterVolume: 0 },
        translatedLabel("ru", "Continue"),
      );
      const card = page.locator('[data-hand-card="true"] button').first();
      await expect.poll(() => card.evaluate((node) => !node.closest("[inert]"))).toBe(true);
      const observation = await page.evaluateHandle(() => {
        let cancelled = false;
        // Resize observers finish after rAF callbacks; sample the painted geometry.
        const afterPaint = () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 0);
            });
          });
        const result = (async () => {
          while (!cancelled && !document.querySelector('[data-testid="reaction-text"]')) {
            await afterPaint();
          }
          const started = performance.now();
          let lastSeen = 0;
          let frames = 0;
          let maximumNames = 0;
          const seenNames = new Set<string>();
          let overflow = false;
          let overflowDetails = "";
          let numericSizingChanged = false;
          let smallestGlyphHeight = Infinity;
          let smallestGlyphDetails = "";
          while (!cancelled && performance.now() - started < 2500) {
            await afterPaint();
            if (performance.now() - started >= 2500) break;
            const names = [...document.querySelectorAll<HTMLElement>('[data-testid="reaction-text"]')].filter(
              (node) => getComputedStyle(node).visibility === "visible",
            );
            names.forEach((name) => seenNames.add(name.dataset.reaction ?? ""));
            if (seenNames.size === 4 && names.length === 0) break;
            if (names.length > 0) {
              maximumNames = Math.max(maximumNames, names.length);
              lastSeen = performance.now() - started;
              frames++;
              for (const number of document.querySelectorAll<HTMLElement>('[data-testid="combat-text"]')) {
                const lane = number.closest<HTMLElement>("[data-feedback-lane]")?.dataset.feedbackLane;
                const base =
                  32 *
                  Number(getComputedStyle(number).getPropertyValue("--content-scale") || 1) *
                  (lane === "benefit" || lane === "setback" ? 0.8 : 1);
                numericSizingChanged ||= Math.abs(Number.parseFloat(getComputedStyle(number).fontSize) - base) > 0.1;
              }
              for (const name of names) {
                const glyph = name.firstElementChild as HTMLElement;
                const bounds = glyph.getBoundingClientRect();
                if (performance.now() - started > 240 && bounds.height < smallestGlyphHeight) {
                  smallestGlyphHeight = bounds.height;
                  smallestGlyphDetails = JSON.stringify({
                    text: name.textContent,
                    elapsedMs: performance.now() - started,
                    fontSize: getComputedStyle(name).fontSize,
                    width: name.clientWidth,
                    glyphWidth: glyph.offsetWidth,
                  });
                }
                const outside =
                  getComputedStyle(name).whiteSpace !== "nowrap" ||
                  glyph.offsetWidth > name.clientWidth + 1 ||
                  bounds.left < 0 ||
                  bounds.right > innerWidth ||
                  bounds.top < 0 ||
                  bounds.bottom > innerHeight;
                if (outside && !overflow)
                  overflowDetails = JSON.stringify({
                    elapsedMs: performance.now() - started,
                    text: name.textContent,
                    bounds: bounds.toJSON(),
                    whitespace: getComputedStyle(name).whiteSpace,
                    width: name.clientWidth,
                    glyphWidth: glyph.offsetWidth,
                    fontSize: getComputedStyle(name).fontSize,
                    glyphFont: getComputedStyle(glyph).fontSize,
                    transition: getComputedStyle(name).transition,
                  });
                overflow ||= outside;
              }
            }
          }
          return {
            frames,
            maximumNames,
            seenNames: seenNames.size,
            lastSeen,
            overflow,
            overflowDetails,
            numericSizingChanged,
            smallestGlyphHeight,
            smallestGlyphDetails,
            remaining: document.querySelectorAll('[data-testid="reaction-text"]').length,
          };
        })();
        return {
          result,
          cancel: () => {
            cancelled = true;
          },
        };
      });
      const review = await observeDuringAction(observation, () => card.click());
      expect(review.seenNames).toBe(4);
      expect(review.maximumNames).toBeLessThanOrEqual(4);
      expect(review.frames).toBeGreaterThan(10);
      expect(review.lastSeen).toBeGreaterThan(1300);
      expect(review.lastSeen).toBeLessThan(2000);
      expect(review.overflow, review.overflowDetails).toBe(false);
      expect(review.numericSizingChanged, "dense feedback must retain its original numeric size").toBe(false);
      expect(review.smallestGlyphHeight, review.smallestGlyphDetails).toBeGreaterThan(12);
      expect(review.remaining).toBe(0);
    },
  );
}
