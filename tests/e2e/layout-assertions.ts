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

  const first = await locator.nth(0).boundingBox();
  const second = await locator.nth(1).boundingBox();
  expect(first).toBeTruthy();
  expect(second).toBeTruthy();
  const gap = second!.x - (first!.x + first!.width);
  expect(gap).toBeGreaterThanOrEqual(minGap);
}
