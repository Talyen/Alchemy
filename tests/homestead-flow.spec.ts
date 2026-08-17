import type { Locator } from "@playwright/test";
import { expect, test } from "./fixtures/e2e";
import { HomesteadPage } from "./pages/homestead-page";

test.describe("Homestead Flow", () => {
  test.describe("with custom materials", () => {
    test.beforeEach(async ({ page }) => {
      await new HomesteadPage(page).goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
      });
    });

    test("homestead screen shows injected materials count", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      const pills = [
        homestead.materialPill("Wood", 100),
        homestead.materialPill("Iron", 50),
        homestead.materialPill("Herbs", 25),
        homestead.materialPill("Food", 10),
        homestead.materialPill("Crystal", 5),
      ];
      for (const pill of pills) {
        await expect(pill).toBeVisible({ timeout: 3000 });
      }
      const boxes = await Promise.all(pills.map((pill) => pill.boundingBox()));
      const ys = boxes.map((box) => {
        expect(box).not.toBeNull();
        return box!.y;
      });
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(8);
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
      await expect(page.getByText("Wolf").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Bear").first()).toBeVisible();
      await page.getByRole("button", { name: "Next page" }).click();
      await expect(page.getByText("Phoenix").first()).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Homestead Actions", () => {
    test("constructed buildings show their tier status", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
        constructedBuildings: { "blacksmiths-forge": 1, carpentry: 0 },
      });

      await expect(homestead.buildingsTab).toBeVisible();
      await expect(homestead.materialPill("Wood", 100)).toBeVisible({ timeout: 3000 });
    });

    test("planted farm plots show planted status", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
        plantedFarms: { "herb-garden": 1 },
      });

      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Herb Garden/ })).toBeVisible({ timeout: 3000 });
    });

    test("completed research shows in research tab", async ({ page }) => {
      const homestead = new HomesteadPage(page);
      await homestead.goto({
        materialInventory: { wood: 100, iron: 50, herbs: 25, food: 10, crystal: 5 },
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

    test("homestead shell fits content across tabs and collapses vertically for single-row companions tab", async ({
      page,
    }) => {
      const shell = page.locator(".alchemy-shell").first();
      const tabAnchors: Record<"Buildings" | "Farm" | "Research" | "Companions", Locator> = {
        Buildings: page.getByText("Blacksmith").first(),
        Farm: page.getByRole("button", { name: /Herb Garden/ }),
        Research: page.getByText("Leyline Energy").first(),
        Companions: page.getByRole("img", { name: "Wolf" }).first(),
      };

      // Measure only once the shell height has settled so tab transitions do
      // not produce a mid-animation frame.
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

      const twoRowHeights: number[] = [];
      for (const tab of ["Buildings", "Farm", "Research"] as const) {
        await homestead.switchTab(tab);
        await expect(tabAnchors[tab]).toBeVisible({ timeout: 3000 });
        twoRowHeights.push(await settledHeight());
      }

      await homestead.switchTab("Companions");
      await expect(tabAnchors.Companions).toBeVisible({ timeout: 3000 });
      const companionHeight = await settledHeight();

      // Full tab content presence checks (kept with the tab switch so the shell
      // stays visible while asserting content).
      await homestead.switchTab("Buildings");
      await expect(page.getByRole("button", { name: /Blacksmith/ }).first()).toBeVisible({ timeout: 3000 });
      await homestead.switchTab("Farm");
      await expect(page.getByRole("button", { name: /Wheat Field/ })).toBeVisible({ timeout: 3000 });
      await homestead.switchTab("Research");
      await expect(page.getByText("Detect Magic").first()).toBeVisible({ timeout: 3000 });
      await expect(page.getByText("Agility Training").first()).toBeVisible();

      // 2-row upgrade tabs maintain consistent height.
      const max2Row = Math.max(...twoRowHeights);
      const min2Row = Math.min(...twoRowHeights);
      expect(max2Row - min2Row).toBeLessThanOrEqual(1);

      // Single-row companions tab collapses vertically to fit its grid size.
      expect(companionHeight).toBeLessThan(min2Row);
    });
  });
});
