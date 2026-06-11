import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "./helpers";
import { desktop } from "./playwright-tags";

test.describe("Electron display mode", desktop, () => {
  test("setDisplayMode resolves without error", async () => {
    const electronApp = await launchElectronApp();

    try {
      const window = await getElectronMainWindow(electronApp);
      const errors = failOnRuntimeErrors(window);

      await window.evaluate(async () => {
        await window.alchemyDesktop?.setDisplayMode("windowed");
        await window.alchemyDesktop?.setDisplayMode("borderless-fullscreen");
      });

      expect(errors).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
