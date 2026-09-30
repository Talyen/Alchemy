import { expect, test, type Page } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { ELECTRON_PREVIEW_PORT, previewPortFromEnv } from "../playwright-shared";
import { failOnRuntimeErrors } from "../browser-helpers";
import { MenuPage } from "../pages/menu-page";
import { CONTENT_REFERENCE_VIEWPORT } from "../../src/lib/game-constants/ui-layout";

async function measureComposition(page: Page) {
  const campaign = page.getByRole("button", { name: "The Campaign", exact: true });
  await campaign.hover();
  await expect(campaign).toHaveCSS("scale", "1.035");
  const tooltip = page.locator("#tooltip-root .hover-popup-panel[data-visible]").last();
  await expect(tooltip).toBeVisible();
  return {
    artworkWidth: (await campaign.boundingBox())!.width,
    tooltipFont: await tooltip
      .locator("p")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  };
}

test("desktop and browser share composition at matching viewports and desktop fullscreen", async ({ browser }) => {
  const app = await launchElectronApp();
  const web = await browser.newPage({ viewport: CONTENT_REFERENCE_VIEWPORT });
  try {
    const desktop = await getElectronMainWindow(app);
    const desktopErrors = failOnRuntimeErrors(desktop);
    const browserErrors = failOnRuntimeErrors(web);
    await new MenuPage(desktop).expectMainMenuAfterColdStart();
    await desktop.evaluate(() => window.alchemyDesktop!.setDisplayMode("windowed"));
    await app.evaluate(({ BrowserWindow }, viewport) => {
      BrowserWindow.getAllWindows()[0].setContentSize(viewport.width, viewport.height);
    }, CONTENT_REFERENCE_VIEWPORT);
    await expect
      .poll(() => desktop.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual(CONTENT_REFERENCE_VIEWPORT);
    const port = previewPortFromEnv("PLAYWRIGHT_ELECTRON_PREVIEW_PORT", ELECTRON_PREVIEW_PORT);
    await web.goto(`http://127.0.0.1:${port}/`);
    await new MenuPage(web).expectMainMenuAfterColdStart();
    for (const page of [web, desktop]) await new MenuPage(page).openGameModeSelect();
    const baseline = await measureComposition(web);
    expect(baseline.tooltipFont).toBeCloseTo(18, 2);
    const windowed = await measureComposition(desktop);
    expect(windowed.artworkWidth).toBeCloseTo(baseline.artworkWidth, 0);
    expect(windowed.tooltipFont).toBeCloseTo(baseline.tooltipFont, 2);
    await desktop.evaluate(() => window.alchemyDesktop!.setDisplayMode("borderless-fullscreen"));
    const display = await app.evaluate(
      ({ BrowserWindow, screen }) => screen.getDisplayMatching(BrowserWindow.getAllWindows()[0].getBounds()).bounds,
    );
    await expect
      .poll(() => desktop.evaluate(() => ({ width: innerWidth, height: innerHeight })))
      .toEqual({ width: display.width, height: display.height });
    const fullscreen = await measureComposition(desktop);
    const factor = Math.min(
      display.width / CONTENT_REFERENCE_VIEWPORT.width,
      display.height / CONTENT_REFERENCE_VIEWPORT.height,
    );
    expect(fullscreen.artworkWidth / baseline.artworkWidth).toBeCloseTo(factor, 2);
    expect(fullscreen.tooltipFont / baseline.tooltipFont).toBeCloseTo(factor, 2);
    await desktop.screenshot({ path: "reports/display-proportions/desktop-fullscreen.png" });
    expect(desktopErrors).toEqual([]);
    expect(browserErrors).toEqual([]);
  } finally {
    await web.close();
    await app.close();
  }
});
