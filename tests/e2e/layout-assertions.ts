import { expect, type Locator, type Page } from "@playwright/test";

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
  // FadeSlot / tab swaps can leave a brief frame where tiles exist but are not
  // laid out yet; wait until both neighbors report a stable box.
  await expect(async () => {
    first = await locator.nth(0).boundingBox();
    second = await locator.nth(1).boundingBox();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
  }).toPass({ timeout: 5_000 });

  const gap = second!.x - (first!.x + first!.width);
  expect(gap).toBeGreaterThanOrEqual(minGap);
}

export async function assertRowAlignment(locators: Locator[], maxDelta = 8) {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()));
  const ys = boxes.map((box) => {
    expect(box).not.toBeNull();
    return box!.y;
  });
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(maxDelta);
}

export function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
