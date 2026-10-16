import { savedActivityData } from "../fixtures/run-activity";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { launchElectronApp, getElectronMainWindow } from "./electron-helpers";
import { waitForLayoutSettled } from "../e2e/layout-assertions";
import { failOnRuntimeErrors } from "../browser-helpers";
import { mechanics, reviewLayout, translatedLabel } from "../e2e/localization";
import type { ParsedSaveData } from "../../src/lib/validation";
import languages from "../../src/lib/localization/locales/languages.json" with { type: "json" };

// Actual process lifetimes protect the local-only language preference and native
// save boundary; browser page reloads cannot detect failures at either boundary.
test("localized demo survives native quit/relaunch and cross-language resume", async () => {
  // oxlint-disable-next-line playwright/no-skipped-test -- The native demo is explicitly built and selected by its release gate.
  test.skip(process.env.ALCHEMY_EDITION !== "demo", "Requires production demo");
  test.setTimeout(90_000);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "alchemy-electron-test-localized-demo-"));
  let application: ElectronApplication | undefined;
  let activePage: Page | undefined;
  const read = async (page: Page): Promise<ParsedSaveData> =>
    page.evaluate(async () => {
      const slot = await window.alchemyDesktop!.readSaveSlot();
      return JSON.parse(slot.candidates[0] ?? "{}");
    });
  const open = async () => {
    application = await launchElectronApp({ packagedRenderer: true, profile });
    const page = await getElectronMainWindow(application);
    activePage = page;
    const errors = failOnRuntimeErrors(page);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator("#startup-splash")).toHaveCount(0, { timeout: 30_000 });
    await page.waitForFunction(() => {
      const screen = document.querySelector("[data-screen-content]");
      return screen !== null && !screen.hasAttribute("inert");
    });
    await waitForLayoutSettled(page);
    expect(await page.evaluate(() => window.alchemyDesktop?.edition)).toBe("demo");
    return { page, errors };
  };
  try {
    let { page, errors } = await open();
    await page.getByRole("button", { name: "Options", exact: true }).click();
    await page.locator("#language").click();
    await page.getByRole("option", { name: languages["zh-Hans"].name, exact: true }).click();
    const chinese = (english: string) => translatedLabel("zh-Hans", english);
    await page.getByRole("button", { name: chinese("Back"), exact: true }).click();
    await page.getByRole("button", { name: chinese("Play"), exact: true }).click();
    await page.getByRole("button", { name: chinese("The Campaign"), exact: true }).click();
    await page
      .getByRole("button", {
        name: chinese("Select {{value0}}").replace("{{value0}}", chinese("Knight")),
        exact: true,
      })
      .click();
    const hand = page.locator('[data-hand-card="true"] button');
    await expect(hand.first()).toBeVisible();
    await expect.poll(async () => (await read(page)).activeRun?.runDeck.length).toBe(7);
    await expect.poll(() => hand.first().evaluate((element) => !element.closest("[inert]"))).toBe(true);
    await expect(page.getByRole("button", { name: chinese("End Turn"), exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(hand.first()).not.toHaveAttribute("aria-disabled", "true");
    await hand.first().hover();
    const count = await hand.count();
    await hand.first().click();
    await expect(hand).toHaveCount(count - 1);
    await expect
      .poll(async () => savedActivityData((await read(page)).activeRun, "battle")?.battleState?.hand?.length)
      .toBe(count - 1);
    const before = (await read(page)).activeRun;
    expect(errors).toEqual([]);
    await application!.close();
    application = undefined;

    ({ page, errors } = await open());
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
    await expect(page.getByRole("button", { name: chinese("End Turn"), exact: true })).toBeVisible();
    expect(mechanics((await read(page)).activeRun)).toEqual(mechanics(before));
    await reviewLayout(page, "zh-Hans native demo resume");
    await page.getByRole("button", { name: chinese("Open game menu"), exact: true }).click();
    await page
      .getByTestId("game-menu")
      .getByRole("button", { name: chinese("Options"), exact: true })
      .click();
    await page.locator("#language").click();
    await page.getByRole("option", { name: languages.ru.name, exact: true }).click();
    const russian = (english: string) => translatedLabel("ru", english);
    await page.getByRole("button", { name: russian("Back"), exact: true }).click();
    await page.getByRole("button", { name: russian("Continue"), exact: true }).click();
    await expect(page.getByRole("button", { name: russian("End Turn"), exact: true })).toBeVisible();
    expect(mechanics((await read(page)).activeRun)).toEqual(mechanics(before));
    expect(errors).toEqual([]);
    await application!.close();
    application = undefined;

    ({ page, errors } = await open());
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("button", { name: russian("End Turn"), exact: true })).toBeVisible();
    expect(mechanics((await read(page)).activeRun)).toEqual(mechanics(before));
    expect((await read(page)).activeRun?.runDeck).toEqual(before?.runDeck);
    expect(errors).toEqual([]);
  } catch (error) {
    if (activePage && !activePage.isClosed()) {
      await test.info().attach("native-failure-state", {
        body: await activePage.locator("body").ariaSnapshot(),
        contentType: "text/plain",
      });
    }
    throw error;
  } finally {
    await application?.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
