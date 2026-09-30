import { expect, test } from "../../fixtures/e2e";
import { assertNoOverflow, assertStageFitsViewport } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { slow } from "../../playwright-tags";
import { CONTENT_REFERENCE_VIEWPORT } from "../../../src/lib/game-constants/ui-layout";

test.use({ deviceScaleFactor: 2 });

// Browser coverage verifies that stage transforms and the untransformed tooltip
// portal paint at the same scale, rather than only checking the layout arithmetic.
test("Start a Run artwork and tooltips share proportional scaling through resizes", slow, async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize(CONTENT_REFERENCE_VIEWPORT);
  await page.addInitScript(() => {
    localStorage.setItem(
      "alchemy-device-display-v1",
      JSON.stringify({ version: 1, gameSizePercent: 100, tooltipSizePercent: 100 }),
    );
  });
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openGameModeSelect();
  const campaign = page.getByRole("button", { name: "The Campaign", exact: true });
  const image = campaign.locator("img").first();
  await campaign.hover();
  const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").last();
  await expect(tooltip).toBeVisible();
  await expect(campaign).toHaveCSS("scale", "1.035");
  const reference = {
    image: (await image.boundingBox())!,
    tooltipContentWidth: await tooltip.evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
    }),
    font: await tooltip
      .locator("p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  };
  expect(reference.font).toBeCloseTo(18, 2);
  expect((await campaign.boundingBox())!.width).toBeCloseTo(29.025 * 16 * (738 / 1080) * 1.035, 0);

  for (const viewport of [
    CONTENT_REFERENCE_VIEWPORT,
    { width: 1470, height: 956 },
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 3840, height: 2160 },
    { width: 3440, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    const factor = Math.min(
      viewport.width / CONTENT_REFERENCE_VIEWPORT.width,
      viewport.height / CONTENT_REFERENCE_VIEWPORT.height,
    );
    await campaign.hover();
    await expect(campaign).toHaveCSS("scale", "1.035");
    await expect.poll(async () => (await image.boundingBox())!.width / reference.image.width).toBeCloseTo(factor, 2);
    await expect(tooltip).toBeVisible();
    await expect
      .poll(() =>
        tooltip
          .locator("p")
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      )
      .toBeCloseTo(reference.font * factor, 2);
    await expect
      // Keep the fixed one-pixel chrome border out of the proportional content measurement.
      .poll(() =>
        tooltip
          .evaluate((el) => {
            const style = getComputedStyle(el);
            return (
              el.getBoundingClientRect().width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
            );
          })
          .then((width) => width / reference.tooltipContentWidth),
      )
      .toBeCloseTo(factor, 2);
    const art = (await image.boundingBox())!;
    expect(art.width / art.height).toBeCloseTo(reference.image.width / reference.image.height, 2);
    const frame = (await campaign.boundingBox())!;
    expect(frame.width / frame.height).toBeCloseTo(4 / 3, 3);
    await expect(image).toHaveCSS("object-fit", "cover");
    await expect(async () => {
      const box = (await tooltip.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }).toPass();
    await assertStageFitsViewport(page);
    await assertNoOverflow(page, `Start a Run ${viewport.width} × ${viewport.height}`);
    await page.screenshot({ path: `reports/display-proportions/start-a-run-${viewport.width}-${viewport.height}.png` });
  }
});
