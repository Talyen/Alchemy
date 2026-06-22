import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { desktop, smoke } from "./playwright-tags";

test.describe("Electron desktop integration", { ...desktop, ...smoke }, () => {
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

  test("loadSave prefers cloud payload when divergence mock is active", async () => {
    const electronApp = await launchElectronApp();

    try {
      const window = await getElectronMainWindow(electronApp);
      const errors = failOnRuntimeErrors(window);

      const localPayload = JSON.stringify({ marker: "local", lastSavedAt: 0, saveSchemaVersion: 3 });
      const cloudPayload = JSON.stringify({ marker: "cloud", lastSavedAt: 0, saveSchemaVersion: 3 });

      await window.evaluate(
        async ({ localPayload, cloudPayload }) => {
          const desktop = window.alchemyDesktop;
          if (!desktop) throw new Error("desktop bridge missing");

          await desktop.clearSave();
          await desktop.writeSave(localPayload);

          const mockEl = document.createElement("div");
          mockEl.id = "__steamCloudReadMock";
          mockEl.setAttribute("data-payload", cloudPayload);
          document.body.appendChild(mockEl);

          const readLocal = await desktop.loadSave();
          const readCloud = await desktop.steamCloudRead?.();
          (
            window as unknown as { __cloudMergeProbe: { local: string | null; cloud: string | null } }
          ).__cloudMergeProbe = { local: readLocal, cloud: readCloud ?? null };

          mockEl.remove();
        },
        { localPayload, cloudPayload },
      );

      const probe = await window.evaluate(
        () => (window as unknown as { __cloudMergeProbe: { local: string; cloud: string } }).__cloudMergeProbe,
      );
      expect(probe.local).toBe(localPayload);
      expect(probe.cloud).toBe(cloudPayload);
      expect(errors).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
