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
  const count = await locator.count();
  expect(count).toBeGreaterThanOrEqual(minCount);

  let first: { x: number; y: number; width: number; height: number } | null = null;
  let second: { x: number; y: number; width: number; height: number } | null = null;

  await expect(async () => {
    first = await locator.nth(0).boundingBox();
    second = await locator.nth(1).boundingBox();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  }).toPass({ timeout: 5_000 });

  const gap = second!.x - (first!.x + first!.width);
  const visualScale = await locator.first().evaluate((element) => {
    const stage = element.closest('[data-testid="vr-stage"]') ?? document.querySelector('[data-testid="vr-stage"]');
    const stageScale =
      stage instanceof HTMLElement && stage.offsetWidth > 0
        ? stage.getBoundingClientRect().width / stage.offsetWidth
        : 1;
    const contentScale = Number.parseFloat(getComputedStyle(element).getPropertyValue("--content-scale"));
    const scale = stageScale * (Number.isFinite(contentScale) && contentScale > 0 ? contentScale : 1);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  });
  expect(gap / visualScale).toBeGreaterThanOrEqual(minGap - SUBPIXEL_GAP_TOLERANCE);
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
