import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures/e2e";
import { HomesteadPage } from "./pages/homestead-page";
import { assertRowAlignment } from "./helpers";
import { critical } from "./playwright-tags";

test.describe("Homestead Flow", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test.describe("with custom materials", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
      });
    });

    test("homestead screen shows injected materials count", critical, async ({ page }) => {
      const homestead = new HomesteadPage(page);
      const pills = [
        homestead.materialPill("Wood", 100),
        homestead.materialPill("Iron", 50),
        homestead.materialPill("Herbs", 25),
        homestead.materialPill("Food", 10),
        homestead.materialPill("Gems", 5),
      ];
      for (const pill of pills) {
        await expect(pill).toBeVisible({ timeout: 3000 });
      }
      await assertRowAlignment(pills);
    });
  });

  test.describe("with default homestead", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto();
    });

    test("building construction button is visible for blacksmiths forge", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.switchTab("Buildings");
      await expect(await homestead.constructButton()).toBeVisible({ timeout: 3000 });
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
      await expect(page.getByRole("img", { name: "Wolf" })).toBeVisible({ timeout: 3000 });
      await expect(page.getByRole("img", { name: "Bear" })).toBeVisible();
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page.getByRole("img", { name: "Phoenix" })).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Homestead Actions", () => {
    test("buildings, farms, and research show injected state", async ({ page }) => {
      const homestead = new HomesteadPage(page);

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        constructedBuildings: { "blacksmiths-forge": 1, carpentry: 0 },
      });
      await expect(homestead.buildingsTab).toBeVisible();
      await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        plantedFarms: { "herb-garden": 1 },
      });
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });

      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, gems: 5 },
        completedResearch: { "botanical-distillation": 1 },
      });
      await homestead.switchTab("Research");
      await expect(page.getByText("Botanical Distillation").first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Homestead Layout", () => {
    let homestead: HomesteadPage;

    test.beforeEach(async ({ page }) => {
      homestead = new HomesteadPage(page);
      await homestead.goto();
    });

    test("homestead shell maintains consistent height across all tabs including single-row companions tab", async ({
      page,
    }) => {
      const shell = page.locator(".max-w-7xl").first();
      const tabAnchors: Record<"Buildings" | "Farm" | "Research" | "Companions", Locator> = {
        Buildings: page.getByRole("button", { name: /Blacksmith/ }),
        Farm: page.getByRole("button", { name: /Herb Garden/ }),
        Research: page.getByText("Leyline Energy").first(),
        Companions: page.getByRole("img", { name: "Wolf" }),
      };

      const settledHeight = async () => {
        let previous = -1;
        let height = -1;
        for (let attempt = 0; attempt < 10; attempt += 1) {
          height = (await shell.boundingBox())?.height ?? -1;
          if (height > 0 && height === previous) return height;
          previous = height;
          await expect
            .poll(async () => (await shell.boundingBox())?.height ?? -1, {
              message: "shell height should settle after tab switch",
              timeout: 2000,
            })
            .toBeGreaterThan(0);
        }
        return height;
      };

      const allHeights: number[] = [];
      for (const tab of ["Buildings", "Farm", "Research"] as const) {
        await homestead.switchTab(tab);
        await expect(tabAnchors[tab]).toBeVisible({ timeout: 3000 });
        allHeights.push(await settledHeight());
      }

      await homestead.switchTab("Companions");
      await expect(tabAnchors.Companions).toBeVisible({ timeout: 3000 });
      allHeights.push(await settledHeight());

      await homestead.switchTab("Buildings");
      await expect(page.getByRole("button", { name: /Blacksmith/ }).first()).toBeVisible({ timeout: 3000 });
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Wheat Field/ })).toBeVisible({ timeout: 3000 });
      await homestead.switchTab("Research");
      await expect(page.getByText("Detect Magic").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Agility Training").first()).toBeVisible();

      const maxHeight = Math.max(...allHeights);
      const minHeight = Math.min(...allHeights);
      expect(maxHeight - minHeight).toBeLessThanOrEqual(1);
    });
  });
});
