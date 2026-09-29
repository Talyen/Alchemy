import { expect, type Page } from "@playwright/test";
import type { CraftingCurrencyId, GearInstance, GearSlot } from "@/lib/gear";
import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import { MenuPage } from "../pages/menu-page";

export { createEmptyGearLoadouts };

export const bodyGear = {
  instanceId: "gear-body",
  definitionId: "leather-armor-basic" as const,
  affixes: [],
};

const swordGear = {
  instanceId: "gear-sword",
  definitionId: "longsword-basic" as const,
  affixes: [],
};

export interface OpenArmoryOptions {
  inventory?: GearInstance[];
  loadouts?: ReturnType<typeof createEmptyGearLoadouts>;
  craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>;
}

export function gearUnlockedMeta(inventory: GearInstance[], loadouts = createEmptyGearLoadouts()) {
  const gearInventories = createEmptyGearInventories();
  gearInventories.knight = inventory;
  return { gearInventories, gearLoadouts: loadouts };
}

export async function openArmory(page: Page, options: GearInstance[] | OpenArmoryOptions = [bodyGear, swordGear]) {
  const resolved: OpenArmoryOptions = Array.isArray(options) ? { inventory: options } : options;
  const inventory = resolved.inventory ?? [bodyGear, swordGear];
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({
    ...gearUnlockedMeta(inventory, resolved.loadouts ?? createEmptyGearLoadouts()),
    ...(resolved.craftingCurrencies ? { craftingCurrencies: resolved.craftingCurrencies } : {}),
  });
  await page.getByRole("button", { name: "Armory" }).click();
  await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();
  await expect(page.getByTestId("armory-equipment-slot").first()).toBeVisible();
}

export function gearItemLocator(page: Page, title: string) {
  return page.locator(`[data-testid="armory-inventory-item"][data-gear-title="${title}"]`);
}

export function equipmentSlotLocator(page: Page, slot: GearSlot) {
  return page.locator(`[data-testid="armory-equipment-slot"][data-slot="${slot}"]`);
}

export async function selectArmorySlot(page: Page, slot: GearSlot) {
  await equipmentSlotLocator(page, slot).click();
}
