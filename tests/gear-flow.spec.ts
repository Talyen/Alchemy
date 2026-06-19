import { expect } from "@playwright/test";
import {
  bodyGear,
  createEmptyGearLoadouts,
  gearItemLocator,
  openArmory,
  pointerDrag,
  pointerDragToInventory,
  expectSalvageDialog,
  salvageInventoryItem,
} from "./e2e/armory";
import { startBattleWithDeck } from "./e2e/battle-setup";
import { makeCard } from "./e2e/cards";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";

const armoryViewports = [
  { width: 1920, height: 1080, label: "standard" },
  { width: 1280, height: 900, label: "wide breakpoint" },
  { width: 1100, height: 800, label: "reduced width" },
  { width: 1366, height: 650, label: "short height" },
];

test.describe("Gear flow", () => {
  test("equipped gear increases physical damage in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>).body = "gear-1";

    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      gearInventory: [
        {
          instanceId: "gear-1",
          definitionId: "leather-armor-basic",
          affixes: [{ id: "flat-physical", value: 1 }],
        },
      ],
      gearLoadouts: loadouts,
    });

    const physicalCard = makeCard({
      id: "test-slash",
      title: "Test Slash",
      cost: 0,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });

    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => physicalCard),
    );

    const battle = new BattlePage(page);
    const enemyHpBefore = await battle.enemyHealth();
    await battle.playCardNamed("Test Slash");

    await expect(async () => {
      expect(await battle.enemyHealth()).toBe(enemyHpBefore - 6);
    }).toPass({ timeout: 5000 });
  });

  test("armory screen opens from the main menu", async ({ page }) => {
    await openArmory(page, [{ instanceId: "gear-1", definitionId: "leather-armor-basic", affixes: [] }]);
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  });

  test("opens salvage confirmation from an inventory item", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    await salvageInventoryItem(page, "Leather Armor");
    await expectSalvageDialog(page);
  });

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

  test("swaps equipped gear when dragging inventory item onto occupied slot", async ({ page }) => {
    const helmA = { instanceId: "helm-a", definitionId: "leather-helm-basic" as const, affixes: [] };
    const helmB = { instanceId: "helm-b", definitionId: "leather-helm-basic" as const, affixes: [] };
    const loadouts = createEmptyGearLoadouts();
    (loadouts.knight as Record<string, string | null>).helm = "helm-b";

    await openArmory(page, {
      inventory: [helmA, helmB],
      loadouts,
    });

    const helmSlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="helm"]');
    const helmAItem = gearItemLocator(page, "Leather Helm").first();
    await expect(helmSlot.locator("img")).toHaveCount(2);
    await expect(gearItemLocator(page, "Leather Helm")).toHaveCount(1);

    await pointerDrag(page, helmAItem, helmSlot);

    await expect(helmSlot.locator("img")).toHaveCount(2);
    await expect(gearItemLocator(page, "Leather Helm")).toHaveCount(1);
  });

  test("follows the cursor exactly without magnetization-snapping when dragged over slot", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const item = gearItemLocator(page, "Leather Armor");
    const source = await item.boundingBox();
    expect(source).not.toBeNull();
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');
    const slotBox = await bodySlot.boundingBox();
    expect(slotBox).not.toBeNull();
    const grabOffset = { x: 20, y: 30 };

    await page.mouse.move(source!.x + grabOffset.x, source!.y + grabOffset.y);
    await page.mouse.down();

    const targetX = slotBox!.x + slotBox!.width / 2;
    const targetY = slotBox!.y + slotBox!.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 8 });
    await expect(page.getByTestId("armory-gear-drag-visual")).toBeVisible();

    await expect
      .poll(async () => {
        const box = await page.getByTestId("armory-gear-drag-visual").boundingBox();
        return box
          ? Math.max(Math.abs(box.x - (targetX - grabOffset.x)), Math.abs(box.y - (targetY - grabOffset.y)))
          : Number.POSITIVE_INFINITY;
      })
      .toBeLessThan(5);

    await page.mouse.up();
    await expect(bodySlot.locator("img")).toHaveCount(2);
  });

  test("double-click equips and unequips gear", async ({ page }) => {
    await openArmory(page, [bodyGear]);
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');

    const source = await bodyItem.boundingBox();
    const destination = await bodySlot.boundingBox();
    await bodyItem.dblclick();
    const flyover = page.getByTestId("armory-gear-drag-visual");
    await expect(flyover).toBeVisible();
    const flying = await flyover.boundingBox();
    expect(source).not.toBeNull();
    expect(destination).not.toBeNull();
    expect(flying).not.toBeNull();
    expect(flying!.x).toBeGreaterThan(Math.min(source!.x, destination!.x));
    expect(flying!.x).toBeLessThan(Math.max(source!.x, destination!.x));
    await expect(bodySlot.locator("img")).toHaveCount(1);

    await expect(flyover).toHaveCount(0);
    await expect(bodyItem).toHaveCount(0);
    await expect(bodySlot.locator("img")).toHaveCount(2);

    await bodySlot.dblclick();
    await expect(bodyItem).toBeVisible();
    await expect(bodySlot.locator("img")).toHaveCount(1);
    const board = await page.getByTestId("armory-inventory-board").boundingBox();
    const unequipped = await bodyItem.boundingBox();
    expect(board).not.toBeNull();
    expect(unequipped).not.toBeNull();
    expect(Math.abs(unequipped!.x - board!.x)).toBeLessThan(3);
    expect(Math.abs(unequipped!.y - board!.y)).toBeLessThan(3);
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
    await page.mouse.move(boardBox!.x + boardBox!.width / 2, boardBox!.y + boardBox!.height / 2, { steps: 8 });

    await expect(page.getByTestId("armory-gear-drag-visual")).toBeVisible();
    await expect
      .poll(async () => page.getByTestId("armory-gear-drag-visual").boundingBox())
      .toMatchObject({ width: expect.closeTo(source!.width, 0), height: expect.closeTo(source!.height, 0) });
    await page.mouse.up();
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
    const rings = Array.from({ length: 57 }, (_, index) => ({
      instanceId: `ring-${index}`,
      definitionId: "ruby-ring-basic" as const,
      affixes: [],
    }));
    await openArmory(page, rings);

    const board = page.getByTestId("armory-inventory-board");
    await expect(board).toHaveAttribute("data-scrollable", "true");
    expect(await gearItemLocator(page, "Ruby Ring").count()).toBe(57);
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

  test("keeps Armory editing disabled while a battle is active", async ({ page, fastBattle }) => {
    void fastBattle;
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      gearInventory: [bodyGear],
      gearLoadouts: createEmptyGearLoadouts(),
    });
    await startBattleWithDeck(
      page,
      Array.from({ length: 6 }, () => makeCard()),
    );

    await page.getByRole("button", { name: "Open battle menu" }).click();
    await page.getByRole("button", { name: "Armory" }).click();
    await expect(page.getByText("Equipment can be changed after combat.")).toBeVisible();
    const bodyItem = gearItemLocator(page, "Leather Armor");
    await bodyItem.dblclick();
    await expect(page.locator('[data-testid="armory-equipment-slot"][data-slot="body"] img')).toHaveCount(1);
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

  test("equipped items show tooltips on hover", async ({ page }) => {
    await openArmory(page, [bodyGear]);

    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = page.locator('[data-testid="armory-equipment-slot"][data-slot="body"]');

    // Equip the armor by double clicking
    await bodyItem.dblclick();
    await expect(bodySlot.locator("img")).toHaveCount(2);

    // Hover over the body slot
    await bodySlot.hover();

    // Verify that the tooltip is visible
    const tooltip = page.locator(".armory-inventory-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText("Leather Armor")).toBeVisible();
  });
});
