import { expect, test } from "@playwright/test";
import { enableLoadingScreen, failOnRuntimeErrors } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { slow } from "./playwright-tags";

const LOADING_WORDS = /^(Forging|Growing|Brewing|Simmering|Tinkering|Prestidigitating|Discombobulating)\.\.\.$/;

test.describe("Startup Loading Screen", slow, () => {
  test("loading screen appears and transitions to main menu", async ({ page }) => {
    await enableLoadingScreen(page);

    const errors = failOnRuntimeErrors(page);
    await page.goto("/");

    await expect(page.getByText(LOADING_WORDS)).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);

    expect(errors).toEqual([]);
  });

  test("loading screen shows animated bar element", async ({ page }) => {
    await enableLoadingScreen(page);
    await page.goto("/");

    const bar = page.locator(".alchemy-startup-bar");
    await expect(bar).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);
  });

  test("loading screen respects minimum display duration", async ({ page }) => {
    await enableLoadingScreen(page);

    const start = Date.now();
    await page.goto("/");

    await expect(page.getByText(LOADING_WORDS)).toBeVisible({ timeout: 5000 });
    await new MenuPage(page).expectMainMenu(15000);

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(300);
  });
});
