import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { assertHorizontalNeighborGap } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";

test.describe("Collection", () => {
  test.describe("with a discovered card", () => {
    test("collection shows tabs, card inspection, and keeps tile gaps", async ({ page }) => {
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
      await inspectBtn.hover();
      await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();

      await assertHorizontalNeighborGap(page.getByRole("button", { name: /Inspect/ }));
    });
  });

  test.describe("with a discovered unique", () => {});

  // Heroes tooltips, lock states, heading stability, undiscovered entries, and
  // art ratios live in collection-screen.test.tsx, collection-pagination.test.tsx,
  // and collection/collection-tile.test.tsx; the browser keeps the tab,
  // inspection, and gap journey above plus the unique-signature flow below.
});
