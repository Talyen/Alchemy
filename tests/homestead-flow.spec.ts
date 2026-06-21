import { expect, test } from "@playwright/test";
import { HomesteadPage } from "./pages/homestead-page";
import { critical, prepush } from "./playwright-tags";

test.describe("Homestead Flow", critical, () => {
  test.describe("with custom materials", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      });
    });

    test("homestead screen shows injected materials count", prepush, async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });
      await expect(homestead.materialPill("Iron", 50)).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("with default homestead", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto();
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

    test("homestead farm tab displays visible farm plots", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("img", { name: "Herb Garden" })).toBeVisible();
      // Placeholder farms (e.g. Wheat Field) are hidden until content ships.
      await expect(page.getByText("Wheat Field")).toHaveCount(0);
    });

    test("research tab shows all research options", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Research");
      await expect(page.getByText("Leyline Energy").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Detect Magic").first()).toBeVisible();
      await expect(page.getByText("Agility Training").first()).toBeVisible();
    });
  });

  test.describe("with custom companions", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        discoveredCardIds: ["wolf-companion", "phoenix-companion", "bear-companion", "slash"],
      });
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
