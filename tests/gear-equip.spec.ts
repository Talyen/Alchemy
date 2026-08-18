import { expect } from "@playwright/test";
import type { GearInstance } from "@/lib/gear/types";
import {
  bodyGear,
  createEmptyGearLoadouts,
  equipmentSlotLocator,
  gearItemLocator,
  openArmory,
  selectArmorySlot,
} from "./e2e/armory";
import { test } from "./fixtures/e2e";
import { armory } from "./playwright-tags";

test.describe("Gear equip", armory, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("click-equips, unequips, and switches characters", async ({ page }) => {
    await openArmory(page);

    await selectArmorySlot(page, "body");
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = equipmentSlotLocator(page, "body");
    await expect(bodyItem).toBeVisible();

    await bodyItem.click();
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(bodyItem).toHaveCount(0);

    await bodySlot.click();
    await expect(bodySlot.getByTestId("armory-slot-background")).toBeVisible();
    await expect(bodySlot.locator("img")).toHaveCount(1);
    await expect(bodyItem).toBeVisible();

    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(page.getByRole("button", { name: "Rogue", exact: true })).toHaveClass(/ring-/);
  });

  test("equipped items show tooltips on hover", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await selectArmorySlot(page, "body");
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = equipmentSlotLocator(page, "body");

    await bodyItem.click();
    await expect(bodySlot.locator("img")).toHaveCount(2);

    await bodySlot.hover();

    const tooltip = page.locator(".armory-inventory-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText("Leather Armor")).toBeVisible();
  });

  test("keeps quiver unequippable until Weapon 1 is ranged", async ({ page }) => {
    const longbow: GearInstance = { instanceId: "bow-1", definitionId: "longbow-basic", affixes: [] };
    const quiver: GearInstance = { instanceId: "quiver-1", definitionId: "quiver-basic", affixes: [] };
    const longsword: GearInstance = { instanceId: "sword-1", definitionId: "longsword-basic", affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>)["main-hand"] = "sword-1";

    await openArmory(page, { inventory: [longbow, quiver, longsword], loadouts });

    await selectArmorySlot(page, "off-hand");
    await expect(gearItemLocator(page, "Quiver")).toHaveAttribute("title", "Incompatible with the current loadout");

    await selectArmorySlot(page, "main-hand");
    await gearItemLocator(page, "Longbow").click();
    await expect(equipmentSlotLocator(page, "main-hand").locator("img")).toHaveCount(2);

    await selectArmorySlot(page, "off-hand");
    await expect(gearItemLocator(page, "Quiver")).not.toHaveAttribute("title", "Incompatible with the current loadout");
    await gearItemLocator(page, "Quiver").click();
    await expect(equipmentSlotLocator(page, "off-hand").locator("img")).toHaveCount(2);
  });

  test("click-equips a one-handed weapon into Off-Hand", async ({ page }) => {
    const longsword: GearInstance = { instanceId: "sword-1", definitionId: "longsword-basic", affixes: [] };
    const dagger: GearInstance = { instanceId: "dagger-1", definitionId: "dagger-basic", affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>)["main-hand"] = "sword-1";

    await openArmory(page, { inventory: [longsword, dagger], loadouts });

    await selectArmorySlot(page, "off-hand");
    const daggerItem = gearItemLocator(page, "Dagger");
    await expect(daggerItem).toBeVisible();
    await expect(daggerItem).not.toHaveAttribute("title", "Incompatible with the current loadout");
    await daggerItem.click();
    await expect(equipmentSlotLocator(page, "off-hand").locator("img")).toHaveCount(2);
    await expect(equipmentSlotLocator(page, "main-hand").locator("img")).toHaveCount(2);
  });
});
