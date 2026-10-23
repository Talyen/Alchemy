import { test, expect } from "../fixtures/e2e";
import { seedRandom } from "../browser-helpers";
import { openVisualBattle } from "./scenarios";
import { waitForLayoutSettled } from "../e2e/layout-assertions";
import { translatedLabel } from "../e2e/localization";
import { MenuPage } from "../pages/menu-page";

// These pixels protect artwork, text fitting and layered composition that DOM
// assertions cannot see. The checkpoint and reduced motion keep them repeatable.
test.beforeEach(async ({ page }) => {
  await seedRandom(page, 42);
});

test("battle and card inspection retain their rendered composition", async ({ page, fastBattle }) => {
  void fastBattle;
  await openVisualBattle(page);
  await waitForLayoutSettled(page);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("battle.png");
  await page.getByTestId("draw-pile").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Draw Pile", exact: true })).toBeVisible();
  await waitForLayoutSettled(page);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("card-inspection.png");
});

test("Options retains readable controls in English and German", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.openOptions();
  await waitForLayoutSettled(page);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("options-en.png");
  await page.evaluate(() => localStorage.setItem("alchemy-language-v1", "de"));
  await page.reload();
  await page.getByRole("button", { name: translatedLabel("de", "Options"), exact: true }).click();
  await expect(page.getByRole("heading", { name: translatedLabel("de", "Options"), exact: true })).toBeVisible();
  await waitForLayoutSettled(page);
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot("options-de.png");
});
