import { expect, test } from "./fixtures/e2e";
import { injectHomestead } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { critical } from "./playwright-tags";

test.describe("Collection", critical, () => {
  test("collection shows all three tabs with content and card inspection works", async ({ page }) => {
    await injectHomestead(page, { discoveredCardIds: ["anvil"] });
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

  test("collection card tiles keep horizontal gaps between neighbors", async ({ page }) => {
    await injectHomestead(page, { discoveredCardIds: ["anvil"] });
    const menu = new MenuPage(page);
    await menu.goto();
    await menu.openCollection();

    const tiles = page.getByRole("button", { name: /Inspect/ });
    await expect(tiles.first()).toBeVisible();
    const count = await tiles.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const first = await tiles.nth(0).boundingBox();
    const second = await tiles.nth(1).boundingBox();
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    const gap = second!.x - (first!.x + first!.width);
    expect(gap).toBeGreaterThanOrEqual(16);
  });

  test("collection tab navigation shows bestiary and boon undiscovered entries", async ({ page }) => {
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
