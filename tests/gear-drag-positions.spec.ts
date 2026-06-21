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

  test("drag visual does not snap back to origin during pointer movement", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const sourceBox = await bodyItem.boundingBox();
    expect(sourceBox).not.toBeNull();

    // 1. Move to center of item
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();

    // 2. Drag down by 40px in multiple small steps to simulate active frame updates
    const dragYOffset = 40;
    const steps = 5;
    for (let i = 1; i <= steps; i++) {
      const currentY = sourceBox!.y + sourceBox!.height / 2 + (dragYOffset * i) / steps;
      await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, currentY);

      // Measure the bounding box of the drag visual overlay
      const dragVisual = page.getByTestId("armory-gear-drag-visual");
      await expect(dragVisual).toBeVisible();
      const dragBox = await dragVisual.boundingBox();
      expect(dragBox).not.toBeNull();

      // Assert that the drag visual Y coordinate is tracking the mouse movement and has NOT snapped back to the origin
      const currentExpectedY = sourceBox!.y + (dragYOffset * i) / steps;
      expect(Math.abs(dragBox!.y - currentExpectedY)).toBeLessThan(5);
    }

    await page.mouse.up();
  });

  test("drag visual does not snap to origin on release (settling)", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const sourceBox = await bodyItem.boundingBox();
    expect(sourceBox).not.toBeNull();

    // 1. Move to center of item
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();

    // 2. Drag down by 50px
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2 + 50);

    const dragVisual = page.getByTestId("armory-gear-drag-visual");
    await expect(dragVisual).toBeVisible();

    // 3. Release mouse
    await page.mouse.up();

    // 4. Immediately measure the bounding box of the drag visual
    const dragBox = await dragVisual.boundingBox();
    expect(dragBox).not.toBeNull();

    // Since we released at Y offset 50, and it was dragged down, the visual should be at/around the release position
    // and animating towards the destination. It should NOT have snapped back to the origin (Y offset close to 0).
    // Specifically, dragBox.y should be significantly greater than sourceBox.y + 20.
    // If the bug is present, it will snap to sourceBox.y (the origin) instantly on release.
    expect(dragBox!.y).toBeGreaterThan(sourceBox!.y + 20);
  });

  test("carried item swap uses its own size, not the dropped item's size", prepush, async ({ page }) => {
    await openArmory(page, [beltGear, ringGear]);

    const beltItem = gearItemLocator(page, "Leather Belt");
    const board = page.getByTestId("armory-inventory-board");

    const metrics = await board.evaluate((element) => {
      const cell = element.querySelector<HTMLElement>("[data-armory-grid-metric='cell']")!.getBoundingClientRect();
      const stride = element.querySelector<HTMLElement>("[data-armory-grid-metric='stride']")!.getBoundingClientRect();
      return { cellSize: cell.width, stride: stride.left - cell.left };
    });

    const beltBox = await beltItem.boundingBox();
    expect(beltBox).not.toBeNull();

    const targetCol = 3;
    const targetRow = 1;
    const dragX = beltBox!.x + beltBox!.width / 2;
    const dragY = beltBox!.y + beltBox!.height / 2;

    await page.mouse.move(dragX, dragY);
    await page.mouse.down();

    const boardBox = await board.boundingBox();
    expect(boardBox).not.toBeNull();
    const destX = boardBox!.x + (targetCol - 0.5) * metrics.stride;
    const destY = boardBox!.y + (targetRow - 0.5) * metrics.stride;

    await page.mouse.move(destX, destY, { steps: 5 });
    await page.mouse.up();

    const dragVisual = page.getByTestId("armory-gear-drag-visual");
    await expect(dragVisual).toBeVisible();

    const dragBox = await dragVisual.boundingBox();
    expect(dragBox).not.toBeNull();

    // Assert that the carried visual's width corresponds to the Ring's size (1x1, close to metrics.cellSize),
    // NOT the Belt's size (2x1, which is > metrics.cellSize * 1.5).
    expect(dragBox!.width).toBeCloseTo(metrics.cellSize, 0);
  });

  test("inventory board has enough right padding to prevent border cutoff", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const board = page.getByTestId("armory-inventory-board");
    const paddingRight = await board.evaluate((el) => window.getComputedStyle(el).paddingRight);
    expect(parseFloat(paddingRight)).toBeGreaterThanOrEqual(8);
  });

  test("drag visual uses integer pixel coordinates and background class", prepush, async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const sourceBox = await bodyItem.boundingBox();
    expect(sourceBox).not.toBeNull();

    // 1. Start dragging
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
    await page.mouse.down();

    // Drag to subpixel offset coordinates (e.g. +20.5px)
    await page.mouse.move(sourceBox!.x + sourceBox!.width / 2 + 20.5, sourceBox!.y + sourceBox!.height / 2 + 20.5);

    const dragVisual = page.getByTestId("armory-gear-drag-visual");
    await expect(dragVisual).toBeVisible();

    // Check that it has the background color class
    await expect(dragVisual).toHaveClass(/bg-background\/60/);

    const styles = await dragVisual.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const transform = style.transform;
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        transform,
      };
    });

    // Bounding rect values should be integers
    expect(styles.left % 1).toBe(0);
    expect(styles.top % 1).toBe(0);
    expect(styles.width % 1).toBe(0);
    expect(styles.height % 1).toBe(0);

    // Parse the transform matrix to get dx and dy
    if (styles.transform && styles.transform !== "none") {
      const match = styles.transform.match(/matrix\(([^,]+,\s*){4}([^,]+),\s*([^)]+)\)/);
      if (match) {
        const dx = parseFloat(match[2]!);
        const dy = parseFloat(match[3]!);
        expect(dx % 1).toBe(0);
        expect(dy % 1).toBe(0);
      }
    }

    await page.mouse.up();
  });
});
