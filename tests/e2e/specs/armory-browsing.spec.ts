import { test, expect } from "../../fixtures/e2e";
import { controllerInput } from "../controller-input";
import { openArmory } from "../armory";
import { assertNoOverflow, assertStageFitsViewport } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import type { GearInstance } from "@/lib/gear";

const inventory: GearInstance[] = [
  { instanceId: "basic-sword", definitionId: "longsword-basic", affixes: [{ id: "flat-physical", value: 1 }] },
  { instanceId: "astral-hatchet", definitionId: "hatchet-astral", affixes: [{ id: "flat-physical", value: 2 }] },
  { instanceId: "plain-sword", definitionId: "longsword-basic", affixes: [] },
  { instanceId: "unique-sword", definitionId: "oathkeeper", affixes: [] },
  { instanceId: "armor", definitionId: "leather-armor-basic", affixes: [] },
];

test("fresh profiles can enter Armory without finding Gear", async ({ page }) => {
  const menu = new MenuPage(page);
  await menu.goto();
  await menu.expectMainMenuAfterColdStart();
  await page.getByRole("button", { name: "Armory", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Armory", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Empty", exact: true })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search inventory" })).toBeVisible();
});

test("inventory browsing combines criteria, sorts, and dismisses with keyboard focus", async ({ page }) => {
  await openArmory(page, inventory);
  const items = page.getByTestId("armory-inventory-item");
  const search = page.getByRole("searchbox", { name: "Search inventory" });
  const filters = page.getByRole("button", { name: /^Filters/ });
  const gridTop = (await items.first().boundingBox())!.y;
  await search.fill(" physical  LONGSWORD ");
  await expect(items).toHaveCount(2);
  await expect(page.getByRole("status")).toHaveText("2 of 4 items");
  await controllerInput(page).activate(filters);
  const panel = page.getByRole("dialog", { name: "Inventory filters" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close inventory filters" })).toBeFocused();
  await panel.getByRole("button", { name: "Basic", exact: true }).click();
  await panel.getByRole("searchbox", { name: "Find a keyword" }).fill("physical");
  await panel.getByRole("checkbox", { name: "Physical", exact: true }).check();
  await expect(items).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(filters).toBeFocused();
  await expect(page.getByRole("heading", { name: "Armory", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remove Basic filter", exact: true }).click();
  await expect(items).toHaveCount(2);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(items).toHaveCount(4);
  expect((await items.first().boundingBox())!.y).toBeCloseTo(gridTop, 0);
  await page.getByRole("combobox", { name: "Sort inventory" }).click();
  await page.getByRole("option", { name: "Name: Z–A", exact: true }).click();
  await expect(items.first()).toHaveAttribute("data-gear-title", "Oathkeeper");
  await search.fill("unfindable");
  await expect(page.getByText("No items match your search and filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear inventory search" }).click();
  await expect(items).toHaveCount(4);
  await filters.click();
  await search.click();
  await expect(panel).toBeHidden();
  await expect(search).toBeFocused();
});

test("inventory footer and filter panel fit aspect ratios and Game Size settings", async ({ page }) => {
  test.setTimeout(60_000);
  for (const gameSizePercent of [100, 125]) {
    await page.addInitScript((size) => {
      localStorage.setItem(
        "alchemy-device-display-v1",
        JSON.stringify({ version: 1, gameSizePercent: size, tooltipSizePercent: 100 }),
      );
    }, gameSizePercent);
    await openArmory(page, inventory);
    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 1920, height: 1080 },
      { width: 1024, height: 768 },
      { width: 3440, height: 1440 },
    ]) {
      await page.setViewportSize(viewport);
      const toolbar = page.getByTestId("armory-inventory-controls");
      const inventoryPanel = page.getByTestId("armory-right-panel");
      await expect(toolbar).toBeInViewport();
      await expect(async () => {
        const bar = (await toolbar.boundingBox())!;
        const owner = (await inventoryPanel.boundingBox())!;
        expect(bar.x + bar.width / 2).toBeCloseTo(owner.x + owner.width / 2, 0);
        expect(bar.y + bar.height).toBeLessThanOrEqual(owner.y + owner.height + 1);
      }).toPass();
      await page.getByRole("button", { name: /^Filters/ }).click();
      const panel = page.getByRole("dialog", { name: "Inventory filters" });
      await expect(panel).toBeVisible();
      const box = (await panel.boundingBox())!;
      const reset = (await panel.getByRole("button", { name: "Clear all", exact: true }).boundingBox())!;
      expect(reset.y + reset.height).toBeLessThanOrEqual(box.y + box.height);
      await expect(panel.getByText("4 of 4 items", { exact: true })).toBeVisible();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
      await page.screenshot({ path: `reports/armory-browsing/filters-${viewport.width}-${gameSizePercent}.png` });
      await page.keyboard.press("Escape");
      await assertStageFitsViewport(page);
      await assertNoOverflow(page, `Armory ${viewport.width} / Game Size ${gameSizePercent}`);
      await page.screenshot({ path: `reports/armory-browsing/inventory-${viewport.width}-${gameSizePercent}.png` });
    }
  }
});
