import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "./helpers";
import { desktop } from "./playwright-tags";

test.describe("Electron save roundtrip", desktop, () => {
  test("writes and reads save data through the desktop bridge", async () => {
    const electronApp = await launchElectronApp();

    try {
      const window = await getElectronMainWindow(electronApp);
      const errors = failOnRuntimeErrors(window);

      const payload = JSON.stringify({ marker: "electron-save-test", lastSavedAt: 123 });
      const wrote = await window.evaluate(async (data) => {
        await window.alchemyDesktop?.clearSave();
        return window.alchemyDesktop?.writeSave(data) ?? false;
      }, payload);
      expect(wrote).toBe(true);

      const readBack = await window.evaluate(async () => window.alchemyDesktop?.loadSave() ?? null);
      expect(readBack).toBe(payload);
      expect(errors).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
