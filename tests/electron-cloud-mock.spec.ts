import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "./helpers";
import { desktop } from "./playwright-tags";

test.describe("Electron cloud mock", desktop, () => {
  test("loadSave prefers cloud payload when local and cloud diverge without lastSavedAt", async () => {
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

          const originalCloudRead = desktop.steamCloudRead?.bind(desktop);
          await desktop.clearSave();
          await desktop.writeSave(localPayload);

          desktop.steamCloudRead = async () => cloudPayload;

          const readLocal = await desktop.loadSave();
          const readCloud = await desktop.steamCloudRead?.();
          (window as unknown as { __cloudMergeProbe: { local: string | null; cloud: string | null } }).__cloudMergeProbe =
            { local: readLocal, cloud: readCloud ?? null };

          if (originalCloudRead) {
            desktop.steamCloudRead = originalCloudRead;
          }
        },
        { localPayload, cloudPayload },
      );

      const probe = await window.evaluate(() => (window as unknown as { __cloudMergeProbe: { local: string; cloud: string } }).__cloudMergeProbe);
      expect(probe.local).toBe(localPayload);
      expect(probe.cloud).toBe(cloudPayload);
      expect(errors).toEqual([]);
    } finally {
      await electronApp.close();
    }
  });
});
