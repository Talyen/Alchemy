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

export function createEmptyGearInventories() {
  return Object.fromEntries(characterIds.map((characterId) => [characterId, [] as unknown[]])) as Record<
    string,
    unknown[]
  >;
}

export interface OpenArmoryOptions {
  inventory?: GearInstance[];
  loadouts?: ReturnType<typeof createEmptyGearLoadouts>;
  craftingCurrencies?: Partial<Record<CraftingCurrencyId, number>>;
}

export async function openArmory(page: Page, options: GearInstance[] | OpenArmoryOptions = [bodyGear, helmGear]) {
  const resolved: OpenArmoryOptions = Array.isArray(options) ? { inventory: options } : options;
  const inventory = resolved.inventory ?? [bodyGear, helmGear];
  const gearInventories = createEmptyGearInventories();
  gearInventories.knight = inventory;
  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({
    gearInventories,
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

/**
 * Waits until the committed gear tile for `title` sits at inventory cell
 * (col, row). Asserting the settled item position — instead of polling the
 * transient drag/flyover overlay — keeps drag tests deterministic under
 * full-suite parallel load.
 */
export async function expectItemAtCell(page: Page, title: string, col: number, row: number, tolerance = 3) {
  const item = gearItemLocator(page, title);
  const cell = page.locator(`[data-armory-inventory-cell="${col}-${row}"]`);
  await expect(cell).toBeVisible();
  await expect
    .poll(
      async () => {
        const itemBox = await item.boundingBox();
        const cellBox = await cell.boundingBox();
        if (!itemBox || !cellBox) return Number.POSITIVE_INFINITY;
        return Math.max(Math.abs(itemBox.x - cellBox.x), Math.abs(itemBox.y - cellBox.y));
      },
      { timeout: 5000, message: `"${title}" should settle at inventory cell ${col}-${row}` },
    )
    .toBeLessThanOrEqual(tolerance);
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
  await page.getByLabel(`Salvage ${gearTitle}`, { exact: true }).nth(index).click({ force: true });
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

/**
 * Releases the active pointer drag (the mouse is already positioned at the
 * release point) and captures the drag visual's top edge at the moment its
 * settle node mounts. Reading the rect inside the page at commit time avoids a
 * Playwright round-trip race: the settle spring (≈30–60 ms) can finish before
 * an out-of-page boundingBox() resolves under full-suite parallel load.
 * Returns the settle frame's top in CSS px, or null if no settle node appeared.
 */
export async function releaseDragAndCaptureSettleTop(page: Page): Promise<number | null> {
  const settleTop = page.evaluate(
    () =>
      new Promise<number | null>((resolve) => {
        const previousNode = document.querySelector<HTMLElement>('[data-testid="armory-gear-drag-visual"]');
        let observer: MutationObserver | null = null;
        const fallback = window.setTimeout(() => {
          observer?.disconnect();
          const el = document.querySelector<HTMLElement>('[data-testid="armory-gear-drag-visual"]');
          resolve(el ? el.getBoundingClientRect().top : null);
        }, 500);
        observer = new MutationObserver(() => {
          const el = document.querySelector<HTMLElement>('[data-testid="armory-gear-drag-visual"]');
          if (!el || el === previousNode) return;
          window.clearTimeout(fallback);
          observer?.disconnect();
          const initialTop = el.getBoundingClientRect().top;
          window.requestAnimationFrame(() => {
            resolve(Math.max(initialTop, el.getBoundingClientRect().top));
          });
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page.mouse.up();
  return settleTop;
}
