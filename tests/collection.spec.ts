import { expect, test } from "@playwright/test";
import { MenuPage } from "./pages/menu-page";
import { critical, prepush } from "./playwright-tags";

test.describe("Collection", critical, () => {
  test("collection shows all three tabs with content and card inspection works", prepush, async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openCollection();

    await expect(page.getByRole("button", { name: "Cards" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Bestiary" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Trinkets" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();

    const inspectBtn = page.getByRole("button", { name: /Inspect Anvil/ });
    await expect(inspectBtn).toBeVisible({ timeout: 5000 });
    await inspectBtn.hover();
    await expect(page.getByText(/^Gain \d+ Forge/)).toBeVisible();
  });

  test("collection tab navigation shows bestiary and trinket undiscovered entries", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openCollection();

    await page.getByRole("button", { name: "Bestiary" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Trinkets" }).click();
    await expect(page.getByRole("button", { name: "Inspect Undiscovered Entry" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Cards" }).click();
    await expect(page.getByRole("button", { name: /Inspect/ }).first()).toBeVisible();
  });
});
