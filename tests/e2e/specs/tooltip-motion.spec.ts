import { expect, test } from "../../fixtures/e2e";
import type { Page } from "@playwright/test";
import { injectActiveBattle, makeGoblinBattleState } from "../../browser-helpers";
import { BattlePage } from "../../pages/battle-page";
import { slow } from "../../playwright-tags";
import { observeDuringAction } from "../observe-during-action";

async function observeMotion(page: Page, entering: boolean, activate: () => Promise<void>) {
  const observation = await page.evaluateHandle((entering) => {
    const transitions = new Set<string>();
    const listener = (event: Event) => {
      if (event.target instanceof Element && event.target.matches("#tooltip-root .hover-popup-panel")) {
        transitions.add((event as TransitionEvent).propertyName);
      }
    };
    document.addEventListener("transitionrun", listener, true);
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      document.removeEventListener("transitionrun", listener, true);
    };
    const result = new Promise<{ faded: boolean; moved: boolean; transitions: string[] }>((resolve, reject) => {
      let faded = false;
      let moved = false;
      const start = performance.now();
      const sample = () => {
        if (cancelled) return;
        const panel = document.querySelector("#tooltip-root .hover-popup-panel");
        const style = panel && getComputedStyle(panel);
        const opacity = Number(style?.opacity ?? 0);
        const matrix = new DOMMatrixReadOnly(style?.transform ?? "none");
        const movement = Math.hypot(matrix.m41, matrix.m42);
        // Compositor startup can delay transitionrun beyond a short exit's lifetime.
        for (const animation of panel?.getAnimations() ?? []) {
          if (animation instanceof CSSTransition) transitions.add(animation.transitionProperty);
        }
        faded ||= opacity > 0 && opacity < 0.99;
        moved ||= movement > 0.1;
        const settled = entering ? panel?.hasAttribute("data-visible") && opacity === 1 && movement < 0.1 : !panel;
        if (settled || performance.now() - start > 2000) {
          cancel();
          if (settled) resolve({ faded, moved, transitions: [...transitions] });
          else reject(new Error(`Tooltip ${entering ? "entry" : "exit"} did not settle`));
        } else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return { result, cancel };
  }, entering);
  return observeDuringAction(observation, activate);
}

test("tooltips visibly fade and move on entry and exit", slow, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await injectActiveBattle(page, makeGoblinBattleState());
  const battle = new BattlePage(page);
  await expect(battle.enemyArt).toBeVisible();
  const entrance = await observeMotion(page, true, () => battle.enemyArt.hover());
  expect(entrance.faded || entrance.transitions.includes("opacity")).toBe(true);
  expect(entrance.moved || entrance.transitions.includes("transform")).toBe(true);
  const exit = await observeMotion(page, false, () => page.mouse.move(0, 0));
  expect(exit.faded || exit.transitions.includes("opacity"), JSON.stringify(exit)).toBe(true);
  await expect(page.locator("#tooltip-root .hover-popup-panel")).toHaveCount(0);
});
