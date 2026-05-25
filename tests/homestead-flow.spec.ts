import { expect, test } from "@playwright/test";
import { injectHomestead } from "./helpers";
import { HomesteadPage } from "./pages/homestead-page";

async function gotoHomestead(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Homestead" }).click();
  await expect(page.getByRole("heading", { name: "Homestead" })).toBeVisible();
}

test.describe("Homestead Flow", () => {
  test.describe("with custom materials", () => {
    test.beforeEach(async ({ page }) => {
      await injectHomestead(page, {
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      });
      await gotoHomestead(page);
    });

    test("homestead screen shows injected materials count", async ({ page }) => {
      await expect(page.getByText(/100/).first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("with default homestead", () => {
    test.beforeEach(async ({ page }) => {
      await injectHomestead(page);
      await gotoHomestead(page);
    });

    test("homestead buildings tab shows all buildings", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await expect(homestead.buildingsTab).toBeVisible();
      await expect(homestead.farmTab).toBeVisible();
      await expect(homestead.researchTab).toBeVisible();
      await expect(homestead.companionsTab).toBeVisible();

      await expect(page.getByText("Blacksmith").first()).toBeVisible({ timeout: 3000 });
    });

    test("building construction button is visible for blacksmiths forge", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Buildings");
      await expect(await homestead.constructButton()).toBeVisible({ timeout: 3000 });
    });

    test("homestead farm tab displays farm plots", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Farm");
      await expect(page.getByText("Herb Garden").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Wheat Field").first()).toBeVisible();
    });

    test("research tab shows all research options", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Research");
      await expect(page.getByText("Carpentry").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Masonry").first()).toBeVisible();
      await expect(page.getByText("Metallurgy").first()).toBeVisible();
    });
  });

  test.describe("with custom companions", () => {
    test.beforeEach(async ({ page }) => {
      await injectHomestead(page, {
        discoveredCardIds: ["wolf-companion", "phoenix-companion", "bear-companion", "slash"],
      });
      await gotoHomestead(page);
    });

    test("companions tab shows companion cards when discovered", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Companions");
      await expect(page.getByText("Wolf").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Phoenix").first()).toBeVisible();
      await expect(page.getByText("Bear").first()).toBeVisible();
    });
  });
});
