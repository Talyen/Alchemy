import { mkdirSync } from "node:fs";
import { saveEnvelopeFixture } from "../fixtures/saves";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { launchElectronApp, getElectronMainWindow } from "./electron-helpers";
import { MenuPage } from "../pages/menu-page";
import { failOnRuntimeErrors, assertStageFitsViewport } from "../browser-helpers";
import { exerciseControllerOptions } from "../e2e/controller-options";

test.describe("isolated offline demo acceptance", () => {
  // oxlint-disable-next-line playwright/no-skipped-test -- uses a demo build and tests its extra menu/footer controls
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Explicit demo renderer required");
  let application: ElectronApplication;
  let page: Page;

  test.beforeEach(async () => {
    application = await launchElectronApp({ packagedRenderer: true });
    page = await getElectronMainWindow(application);
    await new MenuPage(page).expectMainMenuAfterColdStart();
    await page.evaluate(
      (save) => window.alchemyDesktop?.writeSave(JSON.stringify(save)),
      saveEnvelopeFixture({ displayMode: "windowed" }),
    );
    await page.reload();
  });

  test.afterEach(async () => {
    await application?.evaluate(({ app }) => app.removeAllListeners("before-quit")).catch(() => {});
    await application?.close();
  });

  test("menu/footer and Options fit minimum resolutions and size extremes", async ({ browserName }, testInfo) => {
    void browserName;
    const errors = failOnRuntimeErrors(page);
    await new MenuPage(page).expectMainMenuAfterColdStart();
    expect(await page.evaluate(() => window.alchemyDesktop?.edition)).toBe("demo");
    await expect(page.getByText("Steam Demo · Campaign Act 1", { exact: true })).toHaveCount(0);
    const wishlist = await page.getByRole("button", { name: "Wishlist on Steam", exact: true }).boundingBox();
    const play = await page.getByRole("button", { name: "Play", exact: true }).boundingBox();
    expect(wishlist!.y + wishlist!.height).toBeLessThan(play!.y);
    for (const height of [720, 800]) {
      await page.evaluate(async () => window.alchemyDesktop?.setDisplayMode("windowed"));
      await application.evaluate(
        ({ BrowserWindow }, h) => BrowserWindow.getAllWindows()[0].setContentSize(1280, h),
        height,
      );
      for (const gameSizePercent of [80, 120]) {
        await page.evaluate(
          (percent) =>
            localStorage.setItem(
              "alchemy-device-display-v1",
              JSON.stringify({ version: 1, gameSizePercent: percent, tooltipSizePercent: 125 }),
            ),
          gameSizePercent,
        );
        await page.reload();
        await new MenuPage(page).expectMainMenuAfterColdStart();
        const nativeHeight = await application.evaluate(({ BrowserWindow, screen }, requestedHeight) => {
          const window = BrowserWindow.getAllWindows()[0];
          const outer = window.getBounds();
          const content = window.getContentBounds();
          const workArea = screen.getDisplayMatching(outer).workArea;
          const available = workArea.height - (outer.height - content.height);
          const target = Math.min(requestedHeight, available);
          window.setContentSize(1280, target);
          return target;
        }, height);
        await expect
          .poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
          .toEqual({ width: 1280, height: nativeHeight });
        await assertStageFitsViewport(page);
        for (const name of ["Play", "Options", "Quit", "Wishlist on Steam"])
          await expect(page.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 0.99 });
        mkdirSync("reports/demo-acceptance/ui", { recursive: true });
        const screenshot = await page.screenshot({
          path: `reports/demo-acceptance/ui/menu-${height}-${gameSizePercent}.png`,
        });
        await testInfo.attach(`menu-${height}-${gameSizePercent}`, { body: screenshot, contentType: "image/png" });
      }
    }
    await exerciseControllerOptions(page);
    expect(errors).toEqual([]);
  });

  test("Quit opens no browser", async () => {
    await new MenuPage(page).expectMainMenuAfterColdStart();
    await application.evaluate(({ shell }) => {
      const probe = globalThis as typeof globalThis & { externalLinks?: string[] };
      probe.externalLinks = [];
      shell.openExternal = (url) => {
        probe.externalLinks!.push(url);
        return Promise.resolve();
      };
    });
    const links = () =>
      application.evaluate(() => (globalThis as typeof globalThis & { externalLinks: string[] }).externalLinks);
    await application.evaluate(({ app }) => {
      app.on("before-quit", (event) => event.preventDefault());
    });
    await page.getByRole("button", { name: "Quit", exact: true }).click();
    expect(await links()).toEqual([]);
    await application.evaluate(({ app }) => app.removeAllListeners("before-quit"));
  });
});
