import { exerciseControllerOptions } from "../e2e/controller-options";
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "../browser-helpers";
import { MenuPage } from "../pages/menu-page";
import { desktop } from "../playwright-tags";

test.describe("Electron desktop integration", { tag: [desktop.tag] }, () => {
  let electronApp: ElectronApplication | undefined;
  let window: Page;

  test.beforeEach(async () => {
    electronApp = await launchElectronApp();
    window = await getElectronMainWindow(electronApp);
  });

  test.afterEach(async () => {
    await electronApp?.close();
  });

  test("desktop bridge is exposed and main menu renders", { tag: "@local-electron-smoke" }, async () => {
    const errors = failOnRuntimeErrors(window);

    const isDesktop = await window.evaluate(() => window.alchemyDesktop?.isDesktop === true);
    expect(isDesktop).toBe(true);

    await new MenuPage(window).expectMainMenuAfterColdStart();
    expect(errors).toEqual([]);
  });

  test("mapped controller keys navigate desktop Options", async () => {
    const errors = failOnRuntimeErrors(window);
    await new MenuPage(window).expectMainMenuAfterColdStart();
    await exerciseControllerOptions(window);
    expect(errors).toEqual([]);
  });

  test("writes and reads save data through the desktop bridge", async () => {
    const errors = failOnRuntimeErrors(window);

    const payload = JSON.stringify({ marker: "electron-save-test", lastSavedAt: 123 });
    const wrote = await window.evaluate(async (data) => {
      await window.alchemyDesktop?.clearSave();
      return window.alchemyDesktop?.writeSave(data) ?? false;
    }, payload);
    expect(wrote).toBe(true);
    const profile = await electronApp!.evaluate(({ app }) => app.getPath("userData"));
    expect(path.basename(profile)).toMatch(/^alchemy-electron-test-/);
    expect(fs.readFileSync(path.join(profile, "save.json"), "utf8")).toBe(payload);

    const readBack = await window.evaluate(
      async () => ((await window.alchemyDesktop?.listSaveCandidates()) ?? [])[0] ?? null,
    );
    expect(readBack).toBe(payload);
    expect(errors).toEqual([]);
  });

  test("recovery saves stay separate and clearSave removes both rings", async () => {
    const errors = failOnRuntimeErrors(window);

    await window.evaluate(async () => {
      const desktop = window.alchemyDesktop;
      if (!desktop) throw new Error("desktop bridge missing");
      await desktop.clearSave();

      for (let i = 0; i < 4; i += 1) {
        const ok = await desktop.writeSave(JSON.stringify({ marker: `bak-ring-${i}`, lastSavedAt: i }));
        if (!ok) throw new Error(`writeSave failed at ${i}`);
      }
      const recovered = await desktop.writeSave(JSON.stringify({ marker: "recovery" }), "recovery");
      if (!recovered) throw new Error("recovery write failed");
    });

    const beforeClear = await window.evaluate(async () => (await window.alchemyDesktop?.listSaveCandidates()) ?? []);
    expect(beforeClear.length).toBeGreaterThan(1);
    const recoveryBeforeClear = await window.evaluate(
      async () => (await window.alchemyDesktop?.listSaveCandidates("recovery")) ?? [],
    );
    expect(recoveryBeforeClear).toHaveLength(1);
    expect(JSON.parse(recoveryBeforeClear[0] ?? "{}").marker).toBe("recovery");
    const recoveryDetails = await window.evaluate(() => window.alchemyDesktop?.readSaveSlot("recovery"));
    expect(recoveryDetails).toEqual({ candidates: recoveryBeforeClear, localReadFailed: false });
    const profile = await electronApp!.evaluate(({ app }) => app.getPath("userData"));
    expect(fs.readFileSync(path.join(profile, "save-recovery.json"), "utf8")).toBe(recoveryBeforeClear[0]);

    const cleared = await window.evaluate(async () => window.alchemyDesktop?.clearSave() ?? false);
    expect(cleared).toBe(true);

    const afterClear = await window.evaluate(async () => (await window.alchemyDesktop?.listSaveCandidates()) ?? []);
    expect(afterClear).toEqual([]);
    const recoveryAfterClear = await window.evaluate(
      async () => (await window.alchemyDesktop?.listSaveCandidates("recovery")) ?? [],
    );
    expect(recoveryAfterClear).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("setDisplayMode resolves without error", async () => {
    const errors = failOnRuntimeErrors(window);

    await window.evaluate(async () => {
      await window.alchemyDesktop?.setDisplayMode("windowed");
      await window.alchemyDesktop?.setDisplayMode("borderless-fullscreen");
    });

    expect(errors).toEqual([]);
  });

  test("macOS fullscreen fills the display and restores window controls", async () => {
    // eslint-disable-next-line playwright/no-skipped-test -- Simple fullscreen is a macOS-only native API.
    test.skip(process.platform !== "darwin", "macOS notch and simple fullscreen behavior");
    const errors = failOnRuntimeErrors(window);
    await new MenuPage(window).expectMainMenuAfterColdStart();

    const expectFullDisplay = async () => {
      const display = await electronApp!.evaluate(({ BrowserWindow, screen }) => {
        const main = BrowserWindow.getAllWindows()[0];
        return screen.getDisplayMatching(main.getBounds()).bounds;
      });
      await expect
        .poll(() =>
          electronApp!.evaluate(({ BrowserWindow }) => {
            const main = BrowserWindow.getAllWindows()[0];
            return {
              simple: main.isSimpleFullScreen(),
              native: main.isFullScreen(),
              bounds: main.getContentBounds(),
            };
          }),
        )
        .toEqual({ simple: true, native: false, bounds: display });
      await expect
        .poll(() => window.evaluate(() => ({ width: innerWidth, height: innerHeight })))
        .toEqual({ width: display.width, height: display.height });
    };

    await expectFullDisplay();
    for (const mode of ["fullscreen", "borderless-fullscreen"] as const) {
      await window.evaluate(() => window.alchemyDesktop!.setDisplayMode("windowed"));
      await expect
        .poll(() =>
          electronApp!.evaluate(({ BrowserWindow }) => {
            const main = BrowserWindow.getAllWindows()[0];
            return {
              simple: main.isSimpleFullScreen(),
              native: main.isFullScreen(),
              resizable: main.isResizable(),
              minimizable: main.isMinimizable(),
              movable: main.isMovable(),
              size: main.getSize(),
            };
          }),
        )
        .toEqual({
          simple: false,
          native: false,
          resizable: true,
          minimizable: true,
          movable: true,
          size: [1280, 720],
        });
      await window.evaluate((value) => window.alchemyDesktop!.setDisplayMode(value), mode);
      await expectFullDisplay();
    }
    expect(errors).toEqual([]);
  });

  test("loadSave prefers cloud payload when divergence mock is active", async () => {
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

        const readLocal = (await desktop.listSaveCandidates())[0] ?? null;
        const readCloud = await desktop.steamCloudRead?.();
        (window as unknown as { __cloudMergeProbe: { local: string | null; cloud: string | null } }).__cloudMergeProbe =
          { local: readLocal, cloud: readCloud ?? null };

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
  });
});

test("mapped controller keys navigate the packaged desktop renderer", desktop, async () => {
  const application = await launchElectronApp({ packagedRenderer: true });
  try {
    const page = await getElectronMainWindow(application);
    const errors = failOnRuntimeErrors(page);
    await new MenuPage(page).expectMainMenuAfterColdStart();
    expect(page.url()).toMatch(/^alchemy:\/\//);
    await exerciseControllerOptions(page);
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});
