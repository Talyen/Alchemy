import { expect, type Locator, type Page } from "@playwright/test";

const SUBPIXEL_GAP_TOLERANCE = 0.5;

export async function assertNoOverflow(page: Page, screenName: string) {
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    vw: window.innerWidth,
    vh: window.innerHeight,
  }));
  expect(
    layout.width,
    `${screenName}: scrollWidth ${layout.width} should be <= viewport width ${layout.vw}`,
  ).toBeLessThanOrEqual(layout.vw);
  expect(
    layout.height,
    `${screenName}: scrollHeight ${layout.height} should be <= viewport height ${layout.vh}`,
  ).toBeLessThanOrEqual(layout.vh);
}

export async function assertStageFitsViewport(page: Page) {
  const bounds = await page.getByTestId("vr-stage").evaluate((stage) => {
    const rect = stage.getBoundingClientRect();
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

export async function assertHorizontalNeighborGap(
  locator: Locator,
  { minGap = 16, minCount = 2 }: { minGap?: number; minCount?: number } = {},
) {
  await expect(locator.first()).toBeVisible();
  await expect(async () => {
    const layout = await locator.evaluateAll((elements) => {
      const first = elements[0];
      const second = elements[1];
      if (!first || !second) return null;
      const a = first.getBoundingClientRect();
      const b = second.getBoundingClientRect();
      const stage = first.closest('[data-testid="vr-stage"]') ?? document.querySelector('[data-testid="vr-stage"]');
      const stageScale =
        stage instanceof HTMLElement && stage.offsetWidth > 0
          ? stage.getBoundingClientRect().width / stage.offsetWidth
          : 1;
      const contentScale = Number.parseFloat(getComputedStyle(first).getPropertyValue("--content-scale"));
      const scale = stageScale * (Number.isFinite(contentScale) && contentScale > 0 ? contentScale : 1);
      return {
        count: elements.length,
        width: Math.min(a.width, b.width),
        gap: (b.x - a.right) / (Number.isFinite(scale) && scale > 0 ? scale : 1),
      };
    });
    expect(layout).not.toBeNull();
    expect(layout!.count).toBeGreaterThanOrEqual(minCount);
    expect(layout!.width).toBeGreaterThan(0);
    expect(layout!.gap).toBeGreaterThanOrEqual(minGap - SUBPIXEL_GAP_TOLERANCE);
  }).toPass({ timeout: 5_000 });
}

/** Wait for the active view and virtual-stage geometry before measuring layout. */
export async function waitForLayoutSettled(page: Page, readyTarget?: Locator) {
  if (readyTarget) await expect(readyTarget.first()).toBeVisible();
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="vr-stage"]');
    const root = document.querySelector(".page-enter");
    if (!stage || !root || getComputedStyle(root).opacity !== "1") return false;
    const frame = stage.parentElement;
    if (!frame) return false;
    const stageBounds = stage.getBoundingClientRect();
    const frameBounds = frame.getBoundingClientRect();
    if (Math.abs(stageBounds.width - frameBounds.width) > 1 || Math.abs(stageBounds.height - frameBounds.height) > 1)
      return false;
    const slots = [...root.querySelectorAll(".screen-fade-in,.screen-fade-out,[data-artwork-pending]")].filter(
      (element) => !element.closest('[aria-hidden="true"]'),
    );
    return slots.every(
      (element) =>
        !element.classList.contains("screen-fade-out") &&
        element.getAttribute("data-artwork-pending") !== "true" &&
        getComputedStyle(element).visibility !== "hidden" &&
        getComputedStyle(element).opacity === "1",
    );
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Let resize observers and the resulting React render paint before sampling.
    for (let frame = 0; frame < 6; frame += 1) await new Promise(requestAnimationFrame);
  });
}

/** Check controls, raised hand cards and popups while allowing intentional resting-card bleed. */
export async function assertReachableControlsInViewport(page: Page, screenName: string) {
  const outside = await page
    .locator('button,h1,[role="dialog"],[role="listbox"],.hover-popup-panel[data-visible]')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          if (
            !rect.width ||
            !rect.height ||
            getComputedStyle(element).visibility === "hidden" ||
            element.closest('[aria-hidden="true"]')
          )
            return false;
          // UI.md allows resting hand artwork to cross the bottom edge; its center stays reachable.
          const handSlot = element.closest("[data-hand-slot]");
          if (handSlot && !handSlot.hasAttribute("data-hovered")) {
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            return x < 0 || y < 0 || x > innerWidth || y > innerHeight;
          }
          // Content below an intentional scroll viewport is reachable by scrolling.
          for (let parent = element.parentElement; parent; parent = parent.parentElement) {
            if (
              /(auto|scroll)/.test(getComputedStyle(parent).overflowY) &&
              parent.scrollHeight > parent.clientHeight + 1
            )
              return false;
          }
          return rect.left < -1 || rect.top < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
        })
        .map((element) => ({
          text: element.getAttribute("aria-label") ?? element.textContent,
          bounds: element.getBoundingClientRect().toJSON(),
        })),
    );
  expect(outside, `${screenName}: controls or popups outside the viewport`).toEqual([]);
}
