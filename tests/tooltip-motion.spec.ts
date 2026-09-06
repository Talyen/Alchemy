import { expect, test, type Page } from "@playwright/test";
import { injectActiveBattle, makeGoblinBattleState } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { critical } from "./playwright-tags";

function sampleTooltip(page: Page) {
  return page.evaluate(
    () =>
      new Promise<Array<{ opacity: number; movement: number; visible: boolean }>>((resolve) => {
        const samples: Array<{ opacity: number; movement: number; visible: boolean }> = [];
        const start = performance.now();
        const sample = () => {
          const panel = document.querySelector<HTMLElement>("#tooltip-root .hover-popup-panel");
          if (panel) {
            const style = getComputedStyle(panel);
            const matrix = new DOMMatrixReadOnly(style.transform);
            samples.push({
              opacity: Number(style.opacity),
              movement: Math.hypot(matrix.m41, matrix.m42),
              visible: panel.hasAttribute("data-visible"),
            });
          }
          if (performance.now() - start >= 600) resolve(samples);
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      }),
  );
}

test("tooltips visibly fade and move on entry and exit", critical, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await injectActiveBattle(page, makeGoblinBattleState());
  const battle = new BattlePage(page);
  await expect(battle.enemyArt).toBeVisible();
  const [entrance] = await Promise.all([sampleTooltip(page), battle.enemyArt.hover()]);
  expect(entrance.some((frame) => frame.visible && frame.opacity > 0 && frame.opacity < 0.95)).toBe(true);
  expect(entrance.some((frame) => frame.visible && frame.movement > 0.1)).toBe(true);
  expect(entrance.at(-1)?.opacity).toBe(1);
  expect(entrance.at(-1)?.movement).toBe(0);

  const [exit] = await Promise.all([sampleTooltip(page), page.mouse.move(0, 0)]);
  expect(exit.some((frame) => !frame.visible && frame.opacity > 0 && frame.opacity < 1)).toBe(true);
  await expect(page.locator("#tooltip-root .hover-popup-panel")).toHaveCount(0);
});
