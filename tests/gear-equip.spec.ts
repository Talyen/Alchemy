import { expect } from "@playwright/test";
import type { GearInstance } from "@/lib/gear/types";
import {
  bodyGear,
  createEmptyGearLoadouts,
  expectItemAtCell,
  gearItemLocator,
  openArmory,
  pointerDrag,
  pointerDragToInventory,
} from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { armory } from "./playwright-tags";

test.describe("Gear equip", armory, () => {
  test("keeps the full inventory visible, equips by dragging, and switches characters", async ({ page }) => {
    await openArmory(page);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const helmItem = gearItemLocator(page, "Leather Helm");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    await expect(bodyItem).toBeVisible();
    await expect(helmItem).toBeVisible();

    await pointerDrag(page, bodyItem, bodySlot);
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(bodyItem).toHaveCount(0);
    await expect(helmItem).toBeVisible();

    await pointerDragToInventory(page, bodySlot, page.getByTestId("armory-inventory-board"), 3, 1, 2, 3);
    await expect(bodySlot.getByTestId("armory-slot-background")).toBeVisible();
    await expect(bodySlot.locator("img")).toHaveCount(1);
    await expect(bodyItem).toBeVisible();

    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Rogue" })).toBeVisible();
  });

  test("follows the cursor exactly without magnetization-snapping when dragged over slot", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const item = gearItemLocator(page, "Leather Armor");
    const source = await item.boundingBox();
    expect(source).not.toBeNull();
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const slotBox = await bodySlot.boundingBox();
    expect(slotBox).not.toBeNull();

    const sourceCenterX = source!.x + source!.width / 2;
    const sourceCenterY = source!.y + source!.height / 2;

    await page.mouse.move(sourceCenterX, sourceCenterY);
    await page.mouse.down();

    const targetX = slotBox!.x + slotBox!.width / 2;
    const targetY = slotBox!.y + slotBox!.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await expect(page.getByTestId("armory-gear-drag-visual")).toBeVisible();

    await expect
      .poll(async () => {
        const box = await page.getByTestId("armory-gear-drag-visual").boundingBox();
        return box
          ? Math.max(
              Math.abs(box.x - (targetX - (sourceCenterX - source!.x))),
              Math.abs(box.y - (targetY - (sourceCenterY - source!.y))),
            )
          : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(5);

    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.mouse.up();
    await expect(bodySlot.locator("img")).toHaveCount(2);
  });

  test("double-click equips and unequips gear", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const board = page.getByTestId("armory-inventory-board");

    await pointerDragToInventory(page, bodyItem, board, 3, 1, 2, 3);
    await bodyItem.dblclick();

    // Assert committed outcome rather than racing transient flyover animation
    await expect(bodySlot.locator("img")).toHaveCount(2);

    await bodySlot.dblclick();
    // The unequip commit places the item at the first free cell; assert the
    // committed outcome rather than racing the short-lived flyover visual,
    // which can be frozen mid-flight under parallel load.
    await expectItemAtCell(page, "Leather Armor", 1, 1);
    await expect(bodySlot.locator("img")).toHaveCount(1);
  });

  test("keeps the rendered gear footprint when preview-snapping into inventory", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const board = page.getByTestId("armory-inventory-board");

    await bodyItem.dblclick();
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(page.getByTestId("armory-gear-drag-visual")).toHaveCount(0);
    const source = await bodySlot.boundingBox();
    const boardBox = await board.boundingBox();
    expect(source).not.toBeNull();
    expect(boardBox).not.toBeNull();

    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox!.x + boardBox!.width / 2, boardBox!.y + boardBox!.height / 2, { steps: 5 });

    await expect(page.getByTestId("armory-gear-drag-visual")).toBeVisible();
    await expect
      .poll(async () => page.getByTestId("armory-gear-drag-visual").boundingBox())
      .toMatchObject({ width: expect.closeTo(source!.width, 0), height: expect.closeTo(source!.height, 0) });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.mouse.up();
  });

  test("equipped items show tooltips on hover", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');

    await bodyItem.dblclick();
    await expect(bodySlot.locator("img")).toHaveCount(2);

    await bodySlot.hover();

    const tooltip = page.locator(".armory-inventory-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText("Leather Armor")).toBeVisible();
  });

  test("auto-swaps off-hand quiver when equipping a non-ranged main-hand via drag", async ({ page }) => {
    const longbow: GearInstance = { instanceId: "bow-1", definitionId: "longbow-basic", affixes: [] };
    const quiver: GearInstance = { instanceId: "quiver-1", definitionId: "quiver-basic", affixes: [] };
    const longsword: GearInstance = { instanceId: "sword-1", definitionId: "longsword-basic", affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>)["main-hand"] = "bow-1";
    (loadouts.knight as Record<string, string | null>)["off-hand"] = "quiver-1";

    await openArmory(page, { inventory: [longbow, quiver, longsword], loadouts });

    const mainHandSlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="main-hand"]');
    const offHandSlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="off-hand"]');
    const swordItem = gearItemLocator(page, "Longsword");

    // Verify the starting state: bow + quiver
    await expect(mainHandSlot.locator("img")).toHaveCount(2);
    await expect(offHandSlot.locator("img")).toHaveCount(2);

    // Drag the longsword onto the main-hand slot
    await page.mouse.move(100, 100);
    const source = await swordItem.boundingBox();
    const target = await mainHandSlot.boundingBox();
    expect(source).not.toBeNull();
    expect(target).not.toBeNull();
    await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, { steps: 12 });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await page.mouse.up();

    // After auto-swap: longsword equipped, quiver removed from off-hand
    await expect(mainHandSlot.locator("img")).toHaveCount(2);
    await expect(offHandSlot.getByTestId("armory-slot-background")).toBeVisible();
  });
});
