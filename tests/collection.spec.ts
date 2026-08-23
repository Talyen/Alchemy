import { expect, type Locator } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { assertNoOverflow, assertHorizontalNeighborGap } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Collection", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test.describe("with a discovered card", () => {
    test.beforeEach(async ({ page }) => {
      await new MenuPage(page).gotoCollection({ discoveredCardIds: ["anvil"] });
    });

    test("collection shows all three tabs with content and card inspection works", async ({ page }) => {
      await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

      const inspectBtn = page.getByRole("button", { name: /Inspect Anvil/ });
      await expect(inspectBtn).toBeVisible({ timeout: 5000 });
      await inspectBtn.hover();
      await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();
    });

    test("collection card tiles keep horizontal gaps between neighbors", async ({ page }) => {
      await assertHorizontalNeighborGap(page.getByRole("button", { name: /Inspect/ }));
    });
  });

  test.describe("default homestead", () => {
    test.beforeEach(async ({ page }) => {
      await new MenuPage(page).gotoCollection();
    });

    // Tiles can be measured mid-mount with a zero-area box (0/0 = NaN) while the
    // tab content animates in, so re-measure until every box settles to a finite
    // aspect ratio before asserting.
    async function settledAspectRatios(images: Locator): Promise<number[]> {
      let ratios: number[] = [];
      await expect(async () => {
        ratios = await images.evaluateAll((nodes) =>
          nodes.map((node) => {
            const rect = node.getBoundingClientRect();
            return rect.width / rect.height;
          }),
        );
        expect(ratios.length).toBeGreaterThan(0);
        for (const ratio of ratios) expect(Number.isFinite(ratio)).toBe(true);
      }).toPass({ timeout: 5_000 });
      return ratios;
    }

    test("collection tab navigation shows bestiary and boon undiscovered entries", async ({ page }) => {
      await page.getByRole("button", { name: "Bestiary" }).click();
      await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

      await page.getByRole("button", { name: "Trinkets" }).click();
      await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

      await page.getByRole("button", { name: "Cards" }).click();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
    });

    test("bestiary tiles use landscape art without collection overflow", async ({ page }) => {
      await page.getByRole("button", { name: "Bestiary" }).click();
      const bestiaryButtons = page.locator('button[aria-label="Inspect Undiscovered Entry"]');
      await expect(bestiaryButtons).toHaveCount(6);

      const bestiaryImages = bestiaryButtons.locator("img");
      const ratios = await settledAspectRatios(bestiaryImages);
      expect(ratios).toHaveLength(6);
      for (const ratio of ratios) {
        expect(ratio).toBeCloseTo(4 / 3, 2);
      }

      await assertNoOverflow(page, "collection bestiary");
    });

    test("trinket tiles use portrait art without collection overflow", async ({ page }) => {
      await page.getByRole("button", { name: "Trinkets" }).click();
      const trinketImages = page.locator('button[aria-label="Inspect Undiscovered Entry"] img');
      await expect(trinketImages.first()).toBeVisible();

      const ratios = await settledAspectRatios(trinketImages);
      for (const ratio of ratios) {
        expect(ratio).toBeCloseTo(3 / 4, 2);
      }

      await assertNoOverflow(page, "collection trinkets");
    });
  });
});
