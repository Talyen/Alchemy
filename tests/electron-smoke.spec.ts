import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { desktop, smoke } from "./playwright-tags";

test.describe("Electron desktop smoke", { ...desktop, ...smoke }, () => {
  test("desktop bridge is exposed and main menu renders", async () => {
    const electronApp = await launchElectronApp();

    try {
      const window = await getElectronMainWindow(electronApp);
      const errors = failOnRuntimeErrors(window);

      const isDesktop = await window.evaluate(() => window.alchemyDesktop?.isDesktop === true);
      expect(isDesktop).toBe(true);

      await new MenuPage(window).expectMainMenuAfterColdStart();
      expect(errors).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
