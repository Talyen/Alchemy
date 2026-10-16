import { savedActivityData } from "../fixtures/run-activity";
import { controllerInput } from "../e2e/controller-input";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { BattlePage } from "../pages/battle-page";
import { expect, test } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import { ELECTRON_TEST_BACKGROUND, getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { failOnRuntimeErrors } from "../browser-helpers";
import { MenuPage } from "../pages/menu-page";
import { assertNoOverflow, assertReachableControlsInViewport, waitForLayoutSettled } from "../e2e/layout-assertions";
import { DEVICE_DISPLAY_RANGES } from "../../src/lib/settings-values";
import { desktop } from "../playwright-tags";
import { unpackCatalogs } from "../../src/lib/localization/catalog-format.mjs";
import packed from "../../src/lib/localization/locales/runtime.json" with { type: "json" };
import languages from "../../src/lib/localization/locales/languages.json" with { type: "json" };

const catalogs = unpackCatalogs(packed);
const layoutReview = process.env.ALCHEMY_LOCALIZATION_LAYOUT_REVIEW === "1";
const reviewLocale = process.env.ALCHEMY_LOCALIZATION_REVIEW_LOCALE ?? "de";
if (!Object.hasOwn(languages, reviewLocale)) throw new Error(`Unknown desktop review locale: ${reviewLocale}`);
const locale = reviewLocale as keyof typeof languages;
const label = (english: string) => {
  const id = Object.entries(catalogs.en!).find(([, value]) => value === english)?.[0];
  if (!id) throw new Error(`Unregistered desktop review label: ${english}`);
  return (catalogs[locale] as Record<string, string>)[id]!;
};

test.describe("Electron desktop integration", { tag: [desktop.tag] }, () => {
  let electronApp: ElectronApplication | undefined;
  let window: Page;

  test.beforeEach(async () => {
    electronApp = await launchElectronApp({ packagedRenderer: true });
    window = await getElectronMainWindow(electronApp);
    if (layoutReview) {
      await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
      await window.evaluate(
        (ranges) =>
          localStorage.setItem(
            "alchemy-device-display-v1",
            JSON.stringify({
              version: 1,
              gameSizePercent: ranges.gameSizePercent.max,
              tooltipSizePercent: ranges.tooltipSizePercent.max,
            }),
          ),
        DEVICE_DISPLAY_RANGES,
      );
      await window.reload({ waitUntil: "domcontentloaded" });
    }
  });

  test.afterEach(async () => {
    await electronApp?.close();
  });

  test("desktop bridge is exposed and main menu renders", { tag: "@local-electron-smoke" }, async () => {
    const errors = failOnRuntimeErrors(window);

    const isDesktop = await window.evaluate(() => window.alchemyDesktop?.isDesktop === true);
    expect(isDesktop).toBe(true);
    expect(window.url()).toMatch(/^alchemy:/);
    const language = await window.evaluate(() => window.alchemyDesktop?.steamGetGameLanguage?.());
    // Isolated Electron profiles deliberately do not initialize a real account.
    expect(language).toBeNull();

    await new MenuPage(window).expectMainMenuAfterColdStart();
    // Prove the app protocol loads bundled catalogs and retains the local override.
    await window.getByRole("button", { name: "Options", exact: true }).click();
    await window.locator("#language").click();
    await window.getByRole("option", { name: languages[locale].name, exact: true }).click();
    await expect(window.getByRole("heading", { name: label("Options"), exact: true })).toBeVisible();
    if (layoutReview) {
      const directory = path.resolve("reports/localization-layout");
      fs.mkdirSync(directory, { recursive: true });
      for (const tab of ["Display", "Sound", "Gameplay", "Other"]) {
        await window.getByRole("button", { name: label(tab), exact: true }).click();
        await waitForLayoutSettled(window);
        await assertNoOverflow(window, `Desktop ${tab}`);
        await assertReachableControlsInViewport(window, `Desktop ${tab}`);
        const png = await electronApp!.evaluate(async ({ BrowserWindow }) =>
          (
            await BrowserWindow.getAllWindows()[0].webContents.capturePage(
              { x: 0, y: 0, width: 1280, height: 720 },
              { stayHidden: true, stayAwake: true },
            )
          )
            .toPNG()
            .toString("base64"),
        );
        fs.writeFileSync(path.join(directory, `${locale}-desktop-${tab}.png`), Buffer.from(png, "base64"));
      }
    }
    await window.reload();
    await expect(window.locator("html")).toHaveAttribute("lang", locale);
    await expect(window.getByRole("button", { name: label("Options"), exact: true })).toBeVisible({ timeout: 15_000 });
    if (ELECTRON_TEST_BACKGROUND) {
      expect(
        await electronApp!.evaluate(({ BrowserWindow }) => {
          const main = BrowserWindow.getAllWindows()[0];
          return {
            visible: main.isVisible(),
            focused: main.isFocused(),
            fullscreen: main.isFullScreen(),
            simpleFullscreen: main.isSimpleFullScreen(),
          };
        }),
      ).toEqual({ visible: false, focused: false, fullscreen: false, simpleFullscreen: false });
    }
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

  test.describe("macOS fullscreen", () => {
    // Static skips avoid launching an application on unsupported hosts.
    // oxlint-disable-next-line playwright/no-skipped-test -- Native macOS fullscreen requires an authorized foreground run.
    test.skip(process.platform !== "darwin" || ELECTRON_TEST_BACKGROUND, "Requires foreground macOS");

    test("fills the display and restores window controls", async () => {
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
  });
});

test("mapped controller keys navigate the packaged desktop renderer", desktop, async () => {
  const application = await launchElectronApp({ packagedRenderer: true });
  try {
    const page = await getElectronMainWindow(application);
    const errors = failOnRuntimeErrors(page);
    await new MenuPage(page).expectMainMenuAfterColdStart();
    expect(page.url()).toMatch(/^alchemy:\/\//);
    await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1280, 720));
    const input = controllerInput(page);
    await input.activate(page.getByRole("button", { name: "Options", exact: true }));
    const displayMode = page.getByRole("combobox", { name: "Display Mode" });
    await input.activate(displayMode);
    await input.press("down");
    await input.press("confirm");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(displayMode).toBeFocused();
    await expect(page.getByRole("slider", { name: "Background Particles", exact: true })).toBeInViewport();
    await input.press("back");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});

test("a played desktop run survives closing and relaunching the packaged UI", desktop, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-"));
  let application: ElectronApplication | undefined;
  try {
    application = await launchElectronApp({ packagedRenderer: true, profile });
    let page = await getElectronMainWindow(application);
    const errors = failOnRuntimeErrors(page);
    const menu = new MenuPage(page);
    await menu.expectMainMenuAfterColdStart();
    await menu.openGameModeSelect();
    await page.getByRole("button", { name: "The Campaign", exact: true }).click();
    await menu.selectCharacterAndContinue("Knight");
    const battle = new BattlePage(page);
    await battle.waitForOpeningHand();
    await battle.playFirstCard();
    await battle.endTurn();
    const savePath = path.join(profile, "save.json");
    const readBattle = () =>
      savedActivityData(
        (JSON.parse(fs.readFileSync(savePath, "utf8")) as import("@/features/alchemy/shared/storage").SaveData)
          .activeRun,
        "battle",
      )?.battleState;
    await expect.poll(() => (fs.existsSync(savePath) ? readBattle()?.turn : null)).toBe(2);
    const acknowledged = readBattle();
    if (!acknowledged) throw new Error("No acknowledged battle snapshot");
    expect(acknowledged.hand.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    await application.close();
    application = undefined;
    application = await launchElectronApp({ packagedRenderer: true, profile });
    page = await getElectronMainWindow(application);
    const restoredErrors = failOnRuntimeErrors(page);
    const restored = new BattlePage(page);
    await restored.waitForOpeningHand();
    await expect(restored.endTurnBtn).toBeEnabled();
    await expect.poll(() => restored.playerHealth()).toBe(acknowledged.playerHealth);
    await expect.poll(() => restored.enemyHealth()).toBe(acknowledged.enemyHealth);
    await expect(restored.hand).toHaveCount(acknowledged.hand.length);
    expect(readBattle()?.turn).toBe(2);
    expect(restoredErrors).toEqual([]);
  } finally {
    await application?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
