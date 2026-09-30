import { controllerInput } from "../controller-input";
import { expect, type Locator } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { assertHorizontalNeighborGap } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";

async function expectHoverOnlyShine(entry: Locator) {
  await expect(entry.locator(".shine-border")).toHaveCount(0);
  const idleColor = await entry.evaluate((element) => getComputedStyle(element).borderTopColor);
  await entry.hover();
  await expect(entry.locator(".shine-border")).toHaveCount(1);
  await entry.page().getByRole("heading", { name: "Collection", exact: true }).hover();
  await expect(entry.locator(".shine-border")).toHaveCount(0);
  await expect(entry).toHaveCSS("border-top-color", idleColor);
  await controllerInput(entry.page()).reach(entry, 50);
  await expect(entry.locator(".shine-border")).toHaveCount(1);
  await entry.blur();
  await expect(entry.locator(".shine-border")).toHaveCount(0);
}

test.describe("Collection", () => {
  test.describe("with a discovered card", () => {
    test("collection shows tabs, card inspection, and keeps tile gaps", critical, async ({ page }) => {
      await new MenuPage(page).gotoCollection({ discoveredCardIds: ["anvil"] });

      await expect(page.getByRole("button", { name: "Heroes" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Uniques" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

      await controllerInput(page).activate(page.getByRole("button", { name: "Cards" }));
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
      await expect(page.getByText(/Purge one beneficial status effect/)).toBeVisible();
    });
  });

  // Heroes tooltips, lock states, heading stability, undiscovered entries, and
  // art ratios live in collection-screen.test.tsx, collection-pagination.test.tsx,
  // and collection/collection-tile.test.tsx; the browser keeps the tab,
  // inspection, and gap journey above plus the unique-signature flow below.
});
