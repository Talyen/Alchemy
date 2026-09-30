import { controllerInput } from "../controller-input";
import { BattlePage } from "../../pages/battle-page";
import { expect } from "@playwright/test";
import { bodyGear, equipmentSlotLocator, gearItemLocator, openArmory, selectArmorySlot } from "../armory";
import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import { assertGearFlatDamageBoostsPhysicalDamage } from "../gear-combat";
import { injectActiveBattle, makeGoblinBattleState, makeHighDamageCard } from "../../browser-helpers";
import { MenuPage } from "../../pages/menu-page";
import { test } from "../../fixtures/e2e";
import { critical } from "../../playwright-tags";

const affixedSword = {
  instanceId: "gear-sword",
  definitionId: "longsword-basic" as const,
  affixes: [{ id: "flat-physical" as const, value: 1 }],
};

test.describe("Armory equip", () => {
  test("click-equips, unequips, and switches characters", critical, async ({ page }) => {
    await openArmory(page);

    const input = controllerInput(page);
    await input.activate(page.getByRole("button", { name: "Armor equipment slot", exact: true }));
    const bodyItem = gearItemLocator(page, "Leather Armor");
    const bodySlot = equipmentSlotLocator(page, "body");
    await expect(bodyItem).toBeVisible();

    await controllerInput(page).activate(page.getByRole("button", { name: "Leather Armor", exact: true }));
    await expect(bodySlot.locator("img")).toHaveCount(2);
    await expect(bodyItem).toHaveCount(0);

    await controllerInput(page).activate(page.getByRole("button", { name: "Armor equipment slot", exact: true }));
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

  test(
    "keeps the battling hero browse-only while other heroes remain editable",
    critical,
    async ({ page, fastBattle }) => {
      void fastBattle;
      const gearInventories = createEmptyGearInventories();
      gearInventories.knight = [bodyGear];
      const menu = new MenuPage(page);

      await menu.gotoWithUnlockedMeta({
        gearInventories,
        gearLoadouts: createEmptyGearLoadouts(),
      });
      await injectActiveBattle(page, makeGoblinBattleState());

      await page.getByRole("button", { name: "Open game menu" }).click();
      await page.getByRole("button", { name: "Armory" }).click();
      await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toHaveCount(0);
      await selectArmorySlot(page, "body");
      const bodyItem = gearItemLocator(page, "Leather Armor");
      await expect(bodyItem).toBeVisible();
      await expect(bodyItem.getByRole("button", { name: "Leather Armor", exact: true })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page.getByTestId("armory-item-picker").locator('[data-artwork-pending="true"]')).toHaveCount(0);
      await bodyItem.getByRole("button", { name: "Leather Armor", exact: true }).click({ force: true });
      await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toBeVisible();
      await expect(equipmentSlotLocator(page, "body").locator("img")).toHaveCount(1);
      await page.getByRole("button", { name: "Rogue", exact: true }).click();
      await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toHaveCount(0);
      await gearItemLocator(page, "Leather Armor").getByRole("button", { name: "Leather Armor", exact: true }).click();
      await expect(equipmentSlotLocator(page, "body").locator("img")).toHaveCount(2);
    },
  );
});

test(
  "reserves shared equipment across reload and releases it after victory",
  critical,
  async ({ page, fastBattle }) => {
    void fastBattle;
    const gearInventories = createEmptyGearInventories();
    gearInventories.knight = [affixedSword, bodyGear];
    const gearLoadouts = createEmptyGearLoadouts();
    gearLoadouts.knight["main-hand"] = affixedSword.instanceId;
    await new MenuPage(page).gotoWithUnlockedMeta({ gearInventories, gearLoadouts });
    await injectActiveBattle(
      page,
      makeGoblinBattleState({
        hand: [makeHighDamageCard()],
        deck: Array.from({ length: 6 }, () => makeHighDamageCard()),
      }),
    );
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Armory", exact: true }).click();
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    const reserved = page.getByRole("button", { name: /Longsword. Reserved for Knight/ });
    await expect(reserved).toHaveAttribute("aria-disabled", "true");
    await reserved.hover();
    await expect(page.getByText("Reserved for Knight until their battle ends.", { exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Armory", exact: true }).click();
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    const restoredReserved = page.getByRole("button", { name: /Longsword. Reserved for Knight/ });
    await expect(restoredReserved).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Return to Battle", exact: true }).click();
    const battle = new BattlePage(page);
    await battle.playFirstCard();
    await expect(battle.victoryHeading).toBeVisible();
    await page.getByRole("button", { name: "Open game menu" }).click();
    await page.getByRole("button", { name: "Armory", exact: true }).click();
    await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await gearItemLocator(page, "Longsword").getByRole("button", { name: "Longsword", exact: true }).click();
    await expect(equipmentSlotLocator(page, "main-hand").locator("img")).toHaveCount(2);
  },
);

test.describe("Gear combat", () => {
  test("equipped gear increases physical damage in battle", critical, async ({ page, fastBattle }) => {
    void fastBattle;

    await assertGearFlatDamageBoostsPhysicalDamage(page, {
      instanceId: "gear-1",
      definitionId: "longsword-basic",
      slot: "main-hand",
      affixes: [{ id: "flat-physical", value: 1 }],
    });
  });
});

test.describe("Armory browsing", () => {
  test("inventory browsing combines criteria, sorts, and dismisses with keyboard focus", async ({ page }) => {
    const inventory = [
      {
        instanceId: "basic-sword",
        definitionId: "longsword-basic" as const,
        affixes: [{ id: "flat-physical" as const, value: 1 }],
      },
      {
        instanceId: "astral-hatchet",
        definitionId: "hatchet-astral" as const,
        affixes: [{ id: "flat-physical" as const, value: 2 }],
      },
      { instanceId: "plain-sword", definitionId: "longsword-basic" as const, affixes: [] },
      { instanceId: "unique-sword", definitionId: "oathkeeper" as const, affixes: [] },
      { instanceId: "armor", definitionId: "leather-armor-basic" as const, affixes: [] },
    ];
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
});
