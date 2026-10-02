import { expect, test } from "@playwright/test";
import { getElectronMainWindow, launchElectronApp } from "./electron-helpers";
import { assertStageFitsViewport, failOnRuntimeErrors, waitForLayoutSettled } from "../browser-helpers";
import { MenuPage } from "../pages/menu-page";

test("packaged controls remain reachable at minimum and reference window sizes", async () => {
  const application = await launchElectronApp({ packagedRenderer: true });
  try {
    const page = await getElectronMainWindow(application);
    const errors = failOnRuntimeErrors(page);
    const menu = new MenuPage(page);
    await menu.expectMainMenuAfterColdStart();
    await menu.openOptions();
    await page.getByRole("combobox", { name: "Display Mode" }).click();
    await page.getByRole("option", { name: "Windowed", exact: true }).click();
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
    ]) {
      await application.evaluate(
        ({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height),
        viewport,
      );
      await expect.poll(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight }))).toEqual(viewport);
      await waitForLayoutSettled(page);
      await assertStageFitsViewport(page);
      await expect(page.getByRole("slider", { name: "Background Particles", exact: true })).toBeInViewport();
      await expect(page.getByRole("button", { name: "Back", exact: true })).toBeInViewport();
      await page.getByRole("button", { name: "Other", exact: true }).click();
      await page.getByRole("button", { name: "Clear Save Data", exact: true }).click();
      await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeInViewport();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Display", exact: true }).click();
    }
    expect(errors).toEqual([]);
  } finally {
    await application.close();
  }
});
