import { expect, test } from "@playwright/test";

const LOADING_WORDS = /^(Forging|Growing|Brewing|Simmering|Tinkering|Prestidigitating|Discombobulating)\.\.\.$/;

async function enableLoadingScreen(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.removeItem("alchemy-skip-loading-screen");
    localStorage.removeItem("alchemy-dev-mode");
  });
}

test.describe("Startup Loading Screen", () => {
  test("loading screen appears and transitions to main menu", async ({ page }) => {
    await enableLoadingScreen(page);

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    await expect(page.getByText(LOADING_WORDS)).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 15000 });

    expect(errors).toEqual([]);
  });

  test("loading screen shows animated bar element", async ({ page }) => {
    await enableLoadingScreen(page);
    await page.goto("/");

    const bar = page.locator(".alchemy-startup-bar");
    await expect(bar).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 15000 });
  });

  test("loading screen respects minimum display duration", async ({ page }) => {
    await enableLoadingScreen(page);

    const start = Date.now();
    await page.goto("/");

    await expect(page.getByText(LOADING_WORDS)).toBeVisible({ timeout: 5000 });

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible({ timeout: 15000 });

    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(300);
  });
});
