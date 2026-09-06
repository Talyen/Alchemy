import { expect, test, type Page } from "@playwright/test";
import { injectActiveBattle, makeGoblinBattleState } from "../../helpers";
import { BattlePage } from "../../pages/battle-page";
import { critical } from "../../playwright-tags";

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

async function installTooltipTransitionRecorder(page: Page) {
  await page.evaluate(() => {
    const state = window as unknown as {
      tooltipMotionTransitions?: string[];
      tooltipMotionTransitionListener?: (event: Event) => void;
    };
    const transitions: string[] = [];
    const listener = (event: Event) => {
      if (event.target instanceof Element && event.target.matches("#tooltip-root .hover-popup-panel")) {
        transitions.push((event as TransitionEvent).propertyName);
      }
    };
    state.tooltipMotionTransitions = transitions;
    state.tooltipMotionTransitionListener = listener;
    document.addEventListener("transitionrun", listener, true);
  });
}

async function readTooltipTransitionRecorder(page: Page) {
  return page.evaluate(() => {
    const state = window as unknown as {
      tooltipMotionTransitions?: string[];
      tooltipMotionTransitionListener?: (event: Event) => void;
    };
    if (state.tooltipMotionTransitionListener) {
      document.removeEventListener("transitionrun", state.tooltipMotionTransitionListener, true);
    }
    return [...new Set(state.tooltipMotionTransitions ?? [])];
  });
}

async function readTooltipTransitionStyle(page: Page) {
  return page.locator("#tooltip-root .hover-popup-panel").evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      duration: style.transitionDuration
        .split(",")
        .map((value) => Number.parseFloat(value))
        .some((value) => value > 0),
      properties: style.transitionProperty.split(",").map((value) => value.trim()),
    };
  });
}

test("tooltips visibly fade and move on entry and exit", critical, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await injectActiveBattle(page, makeGoblinBattleState());
  const battle = new BattlePage(page);
  await expect(battle.enemyArt).toBeVisible();
  await installTooltipTransitionRecorder(page);
  const [entrance] = await Promise.all([sampleTooltip(page), battle.enemyArt.hover()]);
  const entranceTransitions = await readTooltipTransitionRecorder(page);
  const entranceTransitionStyle = await readTooltipTransitionStyle(page);
  expect(
    entrance.some((frame) => frame.visible && frame.opacity > 0 && frame.opacity < 0.95) ||
      entranceTransitions.includes("opacity") ||
      (entranceTransitionStyle.duration && entranceTransitionStyle.properties.includes("opacity")),
  ).toBe(true);
  expect(
    entrance.some((frame) => frame.visible && frame.movement > 0.1) ||
      entranceTransitions.includes("transform") ||
      (entranceTransitionStyle.duration && entranceTransitionStyle.properties.includes("transform")),
  ).toBe(true);
  const tooltip = page.locator("#tooltip-root .hover-popup-panel");
  await expect.poll(async () => Number(await tooltip.evaluate((element) => getComputedStyle(element).opacity))).toBe(1);
  await expect
    .poll(async () => {
      const movement = await tooltip.evaluate((element) => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
        return Math.hypot(matrix.m41, matrix.m42);
      });
      return movement;
    })
    .toBe(0);

  const exitTransitionStyle = await readTooltipTransitionStyle(page);
  await installTooltipTransitionRecorder(page);
  const [exit] = await Promise.all([sampleTooltip(page), page.mouse.move(0, 0)]);
  const exitTransitions = await readTooltipTransitionRecorder(page);
  expect(
    exit.some((frame) => !frame.visible && frame.opacity > 0 && frame.opacity < 1) ||
      exitTransitions.includes("opacity") ||
      (exitTransitionStyle.duration && exitTransitionStyle.properties.includes("opacity")),
  ).toBe(true);
  await expect(tooltip).toHaveCount(0);
});
