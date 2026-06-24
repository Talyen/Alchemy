import { expect } from "@playwright/test";
import { bodyGear, gearItemLocator, openArmory, expectSalvageDialog, salvageInventoryItem } from "./e2e/armory";
import { startBattleWithDeck } from "./e2e/battle-setup";
import { makeCard } from "./e2e/cards";
import { test } from "./fixtures/e2e";
import { armory, slow } from "./playwright-tags";

const armoryViewports = [
  { width: 1920, height: 1080, label: "standard" },
  { width: 1280, height: 900, label: "wide breakpoint" },
  { width: 1100, height: 800, label: "reduced width" },
  { width: 1366, height: 650, label: "short height" },
];

test.describe("Gear layout", { ...armory, ...slow }, () => {
  test("armory screen opens from the main menu", async ({ page }) => {
    await openArmory(page, [{ instanceId: "gear-1", definitionId: "leather-armor-basic", affixes: [] }]);
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  });

  test("opens salvage confirmation from an inventory item", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await salvageInventoryItem(page, "Leather Armor");
    await expectSalvageDialog(page);
  });

  for (const viewport of armoryViewports) {
    test(`uses the same equipment and inventory scale at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openArmory(page, [bodyGear, { instanceId: "gear-belt", definitionId: "leather-belt-basic", affixes: [] }]);

      const sizes = await page.evaluate(() => {
        const size = (selector: string) => {
          const rect = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
          return { width: rect.width, height: rect.height };
        };
        return {
          bodySlot: size('[data-testid="armory-equipment-slot"][data-slot="body"]'),
          bodyItem: size('[data-testid="armory-inventory-item"][data-gear-title="Leather Armor"]'),
          beltSlot: size('[data-testid="armory-equipment-slot"][data-slot="belt"]'),
          beltItem: size('[data-testid="armory-inventory-item"][data-gear-title="Leather Belt"]'),
        };
      });

      expect(sizes.bodyItem.width).toBeCloseTo(sizes.bodySlot.width, 2);
      expect(sizes.bodyItem.height).toBeCloseTo(sizes.bodySlot.height, 2);
      expect(sizes.beltItem.width).toBeCloseTo(sizes.beltSlot.width, 2);
      expect(sizes.beltItem.height).toBeCloseTo(sizes.beltSlot.height, 2);
    });
  }

  test("scrolls only occupied inventory rows", async ({ page }) => {
    const rings = Array.from({ length: 65 }, (_, index) => ({
      instanceId: `ring-${index}`,
      definitionId: "ruby-ring-basic" as const,
      affixes: [],
    }));
    await openArmory(page, rings);

    const board = page.getByTestId("armory-inventory-board");
    await expect(board).toHaveAttribute("data-scrollable", "true");
    expect(await gearItemLocator(page, "Ruby Ring").count()).toBe(65);
    await board.hover();
    await page.mouse.wheel(0, 500);

    await expect
      .poll(async () => {
        return await board.evaluate((element) => element.scrollTop);
      })
      .toBeGreaterThan(0);
  });

  test("does not scroll when all occupied rows fit", async ({ page }) => {
    const rings = Array.from({ length: 56 }, (_, index) => ({
      instanceId: `ring-${index}`,
      definitionId: "ruby-ring-basic" as const,
      affixes: [],
    }));
    await openArmory(page, rings);

    const board = page.getByTestId("armory-inventory-board");
    await expect(board).toHaveAttribute("data-scrollable", "false");
    await board.hover();
    await page.mouse.wheel(0, 500);
    expect(await board.evaluate((element) => element.scrollTop)).toBe(0);
  });

  for (const viewport of armoryViewports) {
    test(`contains all Armory boards at ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openArmory(
        page,
        Array.from({ length: 24 }, (_, index) => ({
          instanceId: `layout-${index}`,
          definitionId: index % 2 === 0 ? "leather-armor-basic" : "ruby-ring-basic",
          affixes: [],
        })),
      );

      const result = await page.evaluate(() => {
        const within = (childId: string, parentId: string) => {
          const child = document.querySelector<HTMLElement>(`[data-testid="${childId}"]`)!.getBoundingClientRect();
          const parent = document.querySelector<HTMLElement>(`[data-testid="${parentId}"]`)!.getBoundingClientRect();
          return (
            child.left >= parent.left - 1 &&
            child.right <= parent.right + 1 &&
            child.top >= parent.top - 1 &&
            child.bottom <= parent.bottom + 1
          );
        };
        const scroller = document.querySelector<HTMLElement>(".game-page-scroll")!;
        scroller.scrollTop = scroller.scrollHeight - scroller.clientHeight;
        const shell = document.querySelector<HTMLElement>('[data-testid="armory-screen"]')!.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const selector = document.querySelector<HTMLElement>('[data-testid="armory-character-selector"]')!;
        const selectorButtons = [...selector.querySelectorAll<HTMLElement>("button")];
        const firstButton = selectorButtons[0]!.getBoundingClientRect();
        const lastButton = selectorButtons.at(-1)!.getBoundingClientRect();
        const selectorRect = selector.getBoundingClientRect();
        const slotRects = [...document.querySelectorAll<HTMLElement>('[data-testid="armory-equipment-slot"]')].map(
          (slot) => slot.getBoundingClientRect(),
        );
        const equipmentSlotsOverlap = slotRects.some((rect, index) =>
          slotRects
            .slice(index + 1)
            .some(
              (other) =>
                Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1 &&
                Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1,
            ),
        );
        const slotCenter = (name: string) => {
          const slot = name.toLowerCase();
          const rect = document
            .querySelector<HTMLElement>(`[data-testid="armory-equipment-slot"][data-slot="${slot}"]`)!
            .getBoundingClientRect();
          return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
        };
        const bodyCenter = slotCenter("Body");
        const helmCenter = slotCenter("Helm");
        const beltCenter = slotCenter("Belt");
        return {
          horizontalOverflow: scroller.scrollWidth - scroller.clientWidth,
          equipmentContained: within("armory-equipment-board", "armory-equipment-panel"),
          inventoryContained: within("armory-inventory-board", "armory-inventory-panel"),
          equipmentSlotsOverlap,
          helmCenteredAboveBody: Math.abs(helmCenter.x - bodyCenter.x) <= 1 && helmCenter.y < bodyCenter.y,
          beltCenteredBelowBody: Math.abs(beltCenter.x - bodyCenter.x) <= 1 && beltCenter.y > bodyCenter.y,
          tabsCentered:
            selector.scrollWidth > selector.clientWidth ||
            Math.abs((firstButton.left + lastButton.right) / 2 - (selectorRect.left + selectorRect.right) / 2) <= 2,
          tabsHaveIcons: selectorButtons.every((button) => button.querySelector("svg") !== null),
          canReachBottom: shell.bottom <= scrollerRect.bottom + 1,
        };
      });

      expect(result.horizontalOverflow).toBeLessThanOrEqual(1);
      expect(result.equipmentContained).toBe(true);
      expect(result.inventoryContained).toBe(true);
      expect(result.equipmentSlotsOverlap).toBe(false);
      expect(result.helmCenteredAboveBody).toBe(true);
      expect(result.beltCenteredBelowBody).toBe(true);
      expect(result.tabsCentered).toBe(true);
      expect(result.tabsHaveIcons).toBe(true);
      expect(result.canReachBottom).toBe(true);
    });
  }

  test("character art container in Armory screen is scaled 10% larger than the player art panel in battle screen", async ({
    page,
  }) => {
    await openArmory(page);
    const armoryArtRect = await page.getByTestId("armory-character-art-container").boundingBox();
    expect(armoryArtRect).not.toBeNull();

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );
    const battleArtRect = await page.getByTestId("battle-player-art-panel").boundingBox();
    expect(battleArtRect).not.toBeNull();

    expect(armoryArtRect!.width).toBeCloseTo(battleArtRect!.width * 1.1, 1);
    expect(armoryArtRect!.height).toBeCloseTo(battleArtRect!.height * 1.1, 1);
  });
});
