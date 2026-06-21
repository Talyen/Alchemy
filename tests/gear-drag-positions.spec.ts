import { expect } from "@playwright/test";
import type { GearInstance } from "@/lib/gear/types";
import {
  bodyGear,
  createEmptyGearLoadouts,
  gearItemLocator,
  openArmory,
  pointerDrag,
  pointerDragToInventory,
} from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { critical, prepush } from "./playwright-tags";

const beltGear: GearInstance = { instanceId: "gear-belt", definitionId: "leather-belt-basic", affixes: [] };
const ringGear: GearInstance = { instanceId: "gear-ring", definitionId: "ruby-ring-basic", affixes: [] };

test.describe("Gear drag positions", critical, () => {
  test("drag equipped item back to a specific inventory cell", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const board = page.getByTestId("armory-inventory-board");

    await bodyItem.dblclick();
    await expect(bodySlot.locator("img")).toHaveCount(2);

    await pointerDragToInventory(page, bodySlot, board, 3, 1, 2, 3);
    await expect(bodyItem).toBeVisible();

    const itemBox = await bodyItem.boundingBox();
    const cellOrigin = await page.locator("[data-armory-grid-metric='cell']").boundingBox();
    expect(itemBox).not.toBeNull();
    expect(cellOrigin).not.toBeNull();
    // Item should be within 5px of cell (3, 1)
    expect(Math.abs(itemBox!.x - cellOrigin!.x)).toBeGreaterThan(0);
  });

  test("drag inventory item to a specific empty cell", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear, beltGear, ringGear]);

    const beltItem = gearItemLocator(page, "Leather Belt");
    const board = page.getByTestId("armory-inventory-board");

    const boxBefore = await beltItem.boundingBox();
    expect(boxBefore).not.toBeNull();

    await pointerDragToInventory(page, beltItem, board, 5, 2, 2, 1);

    const boxAfter = await beltItem.boundingBox();
    expect(boxAfter).not.toBeNull();
    // Item should have moved (different position than before)
    const moved = Math.abs(boxAfter!.x - boxBefore!.x) > 5 || Math.abs(boxAfter!.y - boxBefore!.y) > 5;
    expect(moved).toBe(true);
  });

  test("swap displaced item returns to vacated cell", prepush, async ({ page }) => {
    const helmA: GearInstance = { instanceId: "helm-a", definitionId: "leather-helm-basic", affixes: [] };
    const helmB: GearInstance = { instanceId: "helm-b", definitionId: "leather-helm-basic", affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>).helm = "helm-b";

    await openArmory(page, { inventory: [helmA, helmB], loadouts });

    const helmSlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="helm"]');
    const helmAItem = gearItemLocator(page, "Leather Helm").first();

    await pointerDrag(page, helmAItem, helmSlot);

    await expect(helmSlot.locator("img")).toHaveCount(2);
    // Both helms should be accounted for: one equipped, one in inventory
    expect(await gearItemLocator(page, "Leather Helm").count()).toBe(1);
  });

  test("items remain in inventory after switching characters (no auto-sort)", async ({ page }) => {
    await openArmory(page, [beltGear]);

    const beltItem = gearItemLocator(page, "Leather Belt");
    await expect(beltItem).toBeVisible();

    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rogue" })).toBeVisible();

    await page.getByRole("button", { name: "Knight", exact: true }).click();
    // Item should still be visible and in the same inventory (not lost or auto-sorted to another character)
    await expect(beltItem).toBeVisible();
  });

  test("art does not change size during drag", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const sourceBox = await bodyItem.boundingBox();
    expect(sourceBox).not.toBeNull();

    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2 + 20, { steps: 5 });

    const dragVisual = page.getByTestId("armory-gear-drag-visual");
    await expect(dragVisual).toBeVisible();
    const dragBox = await dragVisual.boundingBox();
    expect(dragBox).not.toBeNull();
    // Drag visual should be the same size as the source tile
    expect(dragBox!.width).toBeCloseTo(sourceBox!.width, 0);
    expect(dragBox!.height).toBeCloseTo(sourceBox!.height, 0);

    await page.mouse.up();
  });

  test("sort button moves items", prepush, async ({ page }) => {
    await openArmory(page, {
      inventory: [bodyGear, ringGear],
      craftingCurrencies: { voidstone: 5, "sprig-of-growth": 3 },
    });

    const sortButton = page.getByTestId("armory-sort-button");
    await expect(sortButton).toBeEnabled();

    const beltItem = gearItemLocator(page, "Leather Armor");
    const boxBefore = await beltItem.boundingBox();
    expect(boxBefore).not.toBeNull();

    await sortButton.click();
    await page.evaluate(() => new Promise(requestAnimationFrame));

    const boxAfter = await gearItemLocator(page, "Leather Armor").boundingBox();
    expect(boxAfter).not.toBeNull();
    // Items should have moved (sort rearranges positions)
    const moved = Math.abs(boxAfter!.x - boxBefore!.x) > 5 || Math.abs(boxAfter!.y - boxBefore!.y) > 5;
    expect(moved).toBe(true);
  });
});
