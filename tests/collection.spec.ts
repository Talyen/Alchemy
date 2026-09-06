import { expect, type Locator } from "@playwright/test";
import { test } from "./fixtures/e2e";
import { assertNoOverflow, assertHorizontalNeighborGap } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

async function expectHoverOnlyShine(entry: Locator) {
  await expect(entry.locator(".shine-border")).toHaveCount(0);
  const idleColor = await entry.evaluate((element) => getComputedStyle(element).borderTopColor);
  await entry.hover();
  await expect(entry.locator(".shine-border")).toHaveCount(1);
  await entry.page().getByRole("heading", { name: "Collection", exact: true }).hover();
  await expect(entry.locator(".shine-border")).toHaveCount(0);
  await expect(entry).toHaveCSS("border-top-color", idleColor);
  await entry.focus();
  await expect(entry.locator(".shine-border")).toHaveCount(1);
  await entry.blur();
  await expect(entry.locator(".shine-border")).toHaveCount(0);
}

test.describe("Collection", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test.describe("with a discovered card", () => {
    test("collection shows tabs, card inspection, and keeps tile gaps", async ({ page }) => {
      await new MenuPage(page).gotoCollection({ discoveredCardIds: ["anvil"] });

      await expect(page.getByRole("button", { name: "Heroes" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Uniques" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

      await page.getByRole("button", { name: "Cards" }).click();
      const inspectBtn = page.getByRole("button", { name: /Inspect Anvil/ });
      await expect(inspectBtn).toBeVisible({ timeout: 5000 });
      await expectHoverOnlyShine(inspectBtn);
      await inspectBtn.hover();
      await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();

      await assertHorizontalNeighborGap(page.getByRole("button", { name: /Inspect/ }));
    });
  });

  test.describe("with a discovered unique", () => {
    test("uniques tab reveals the unique name and signature", async ({ page }) => {
      await new MenuPage(page).gotoCollection({ discoveredUniqueIds: ["wardbreaker"] });
      await page.getByRole("button", { name: "Uniques" }).click();
      const inspectBtn = page.getByRole("button", { name: /Inspect Wardbreaker/ });
      const nextPageButton = page.getByRole("button", { name: "Next page" });
      for (let attempts = 0; attempts < 10; attempts += 1) {
        await expect
          .poll(async () => (await inspectBtn.isVisible()) || (await nextPageButton.isEnabled()), { timeout: 5000 })
          .toBe(true);
        if (await inspectBtn.isVisible()) break;
        await expect(nextPageButton).toBeEnabled();
        await nextPageButton.click();
      }
      await expect(inspectBtn).toBeVisible({ timeout: 5000 });
      await expectHoverOnlyShine(inspectBtn);
      await inspectBtn.hover();
      await expect(page.getByText(/Purge one enemy buff/)).toBeVisible();
    });
  });

  test.describe("heroes tab", () => {
    test("defaults to Heroes and shows the starting-deck tooltip for unlocked heroes", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      await expect(page.getByRole("button", { name: "Inspect Knight" })).toBeVisible();

      await expectHoverOnlyShine(page.getByRole("button", { name: "Inspect Knight" }));
      await page.getByRole("button", { name: "Inspect Knight" }).hover();
      await expect(page.getByText("Starting Deck").first()).toBeVisible();
      await expect(page.getByText(/Anvil/).first()).toBeVisible();
    });

    test("locked heroes keep their name and unlock tooltip", async ({ page }) => {
      await new MenuPage(page).gotoCollection({ finishedRunCharacters: [] });
      const rogue = page.getByRole("button", { name: "Inspect Rogue (Locked)" });
      await expect(rogue).toBeVisible();
      await rogue.hover();
      await expect(page.getByText("Finish a Run as the Knight to unlock")).toBeVisible();
    });
  });

  test.describe("default homestead", () => {
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

    test("heroes to cards keeps the collection heading still when pagination appears", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      const heading = page.getByRole("heading", { name: "Collection" });
      await expect(heading).toBeVisible();
      await expect(page.getByRole("button", { name: "Previous page" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0);
      const heroesY = await heading.evaluate((el) => el.getBoundingClientRect().y);
      await page.getByRole("button", { name: "Cards" }).click();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Previous page" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Next page" })).toBeVisible();
      const cardsY = await heading.evaluate((el) => el.getBoundingClientRect().y);
      expect(Math.abs(cardsY - heroesY)).toBeLessThan(0.5);
    });

    test("collection tab navigation shows bestiary and boon undiscovered entries", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      await page.getByRole("button", { name: "Bestiary" }).click();
      await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();
      await page.getByRole("button", { name: "Trinkets" }).click();
      await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();
      await page.getByRole("button", { name: "Uniques" }).click();
      await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();
      await page.getByRole("button", { name: "Cards" }).click();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
    });

    test("bestiary tiles use landscape art without collection overflow", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      await page.getByRole("button", { name: "Bestiary" }).click();
      const bestiaryButtons = page.locator('button[aria-label="Inspect Undiscovered Entry"]');
      await expect(bestiaryButtons).toHaveCount(6);
      const bestiaryImages = bestiaryButtons.locator("img");
      const ratios = await settledAspectRatios(bestiaryImages);
      expect(ratios).toHaveLength(6);
      for (const ratio of ratios) expect(ratio).toBeCloseTo(4 / 3, 2);
      await assertNoOverflow(page, "collection bestiary");
    });

    test("trinket tiles use portrait art without collection overflow", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      await page.getByRole("button", { name: "Trinkets" }).click();
      const trinketImages = page.locator('button[aria-label="Inspect Undiscovered Entry"] img');
      await expect(trinketImages.first()).toBeVisible();
      const ratios = await settledAspectRatios(trinketImages);
      for (const ratio of ratios) expect(ratio).toBeCloseTo(3 / 4, 2);
      await assertNoOverflow(page, "collection trinkets");
    });

    test("unique tiles use portrait art without collection overflow", async ({ page }) => {
      await new MenuPage(page).gotoCollection();
      await page.getByRole("button", { name: "Uniques" }).click();
      const uniqueImages = page.locator('button[aria-label="Inspect Undiscovered Entry"] img');
      await expect(uniqueImages.first()).toBeVisible();
      const ratios = await settledAspectRatios(uniqueImages);
      for (const ratio of ratios) expect(ratio).toBeCloseTo(3 / 4, 2);
      await assertNoOverflow(page, "collection uniques");
    });
  });
});
