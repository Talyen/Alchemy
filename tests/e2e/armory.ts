import { expect, type Locator, type Page } from "@playwright/test";
import type { CraftingCurrencyId, GearInstance } from "@/lib/gear";
import { MenuPage } from "../pages/menu-page";

const characterIds = ["knight", "rogue", "wizard", "ranger", "alchemist", "warlock", "druid", "wildcard"];
const gearSlots = [
  "body",
  "helm",
  "boots",
  "gloves",
  "belt",
  "main-hand",
  "off-hand",
  "left-ring",
  "right-ring",
  "amulet",
] as const;

export const bodyGear = {
  instanceId: "gear-body",
  definitionId: "leather-armor-basic" as const,
  affixes: [],
};

const helmGear = {
  instanceId: "gear-helm",
  definitionId: "leather-helm-basic" as const,
  affixes: [],
};

export function createEmptyGearLoadouts() {
  return Object.fromEntries(
    characterIds.map((characterId) => [characterId, Object.fromEntries(gearSlots.map((slot) => [slot, null]))]),
  );
}

export type OpenArmoryOptions = {
  inventory?: GearInstance[];
  loadouts?: ReturnType<typeof createEmptyGearLoadouts>;
  craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>;
};

export async function openArmory(page: Page, options: GearInstance[] | OpenArmoryOptions = [bodyGear, helmGear]) {
  const resolved: OpenArmoryOptions = Array.isArray(options) ? { inventory: options } : options;
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({
    gearInventory: resolved.inventory ?? [bodyGear, helmGear],
    gearLoadouts: resolved.loadouts ?? createEmptyGearLoadouts(),
    ...(resolved.craftingCurrencies ? { craftingCurrencies: resolved.craftingCurrencies } : {}),
  });
  await page.getByRole("button", { name: "Armory" }).click();
  await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();
  await expect(page.getByTestId("armory-inventory-item").first()).toBeVisible();
}

export function gearItemLocator(page: Page, title: string) {
  return page.locator(`[data-testid="armory-inventory-item"][data-gear-title="${title}"]`);
}

export function currencyLocator(page: Page, currencyId: CraftingCurrencyId) {
  return page.locator(`[data-testid="armory-crafting-currency"][data-currency-id="${currencyId}"]`);
}

export async function activateCurrency(page: Page, currencyId: CraftingCurrencyId) {
  const currency = currencyLocator(page, currencyId);
  await expect(currency).toBeVisible();
  await currency.dblclick();
  await page.getByTestId("armory-inventory-board").hover();
  await expect(page.getByRole("button", { name: new RegExp(`Apply .+`) })).toBeVisible();
}

export async function applyCurrencyToGear(page: Page, gearTitle: string, currencyDisplayName: string) {
  await page.getByRole("button", { name: `Apply ${currencyDisplayName} to ${gearTitle}` }).click();
}

export async function enterSalvageMode(page: Page) {
  const toggle = page.getByTestId("armory-salvage-toggle");
  await expect(toggle).toBeEnabled();
  await toggle.click();
  await expect(page.locator('button[aria-label="Cancel salvage"]')).toBeVisible();
}

export async function salvageInventoryItem(page: Page, gearTitle: string, index = 0) {
  await enterSalvageMode(page);
  await page.getByLabel(`Salvage ${gearTitle}`, { exact: true }).nth(index).click();
}

export async function confirmSalvage(page: Page) {
  await page.getByRole("button", { name: "Salvage", exact: true }).click();
}

export async function expectSalvageDialog(page: Page) {
  await expect(page.getByText("Salvaging items yields crafting materials")).toBeVisible();
}

export async function pointerDrag(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 5 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

export async function pointerDragToInventory(
  page: Page,
  source: Locator,
  board: Locator,
  col: number,
  row: number,
  widthCells: number,
  heightCells: number,
) {
  const sourceBox = await source.boundingBox();
  const metrics = await board.evaluate((element) => {
    const boardRect = element.getBoundingClientRect();
    const cell = element.querySelector<HTMLElement>("[data-armory-grid-metric='cell']")!.getBoundingClientRect();
    const stride = element.querySelector<HTMLElement>("[data-armory-grid-metric='stride']")!.getBoundingClientRect();
    return { left: boardRect.left, top: boardRect.top, cellSize: cell.width, stride: stride.left - cell.left };
  });
  expect(sourceBox).not.toBeNull();
  const targetX =
    metrics.left +
    (col - 1) * metrics.stride +
    (widthCells * metrics.cellSize + (widthCells - 1) * (metrics.stride - metrics.cellSize)) / 2;
  const targetY =
    metrics.top +
    (row - 1) * metrics.stride +
    (heightCells * metrics.cellSize + (heightCells - 1) * (metrics.stride - metrics.cellSize)) / 2;
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 5 });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
