import { controllerInput } from "../controller-input";
import { expect } from "@playwright/test";
import { test } from "../../fixtures/e2e";
import { assertHorizontalNeighborGap } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { critical } from "../../playwright-tags";

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
  await inspectBtn.hover();
  await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();

  await assertHorizontalNeighborGap(page.getByRole("button", { name: /Inspect/ }));
});
