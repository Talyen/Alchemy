import { BattlePage } from "../../pages/battle-page";
import { expect } from "@playwright/test";
import type { GearInstance } from "@/lib/gear/types";
import { EMPTY_CRAFTING_CURRENCIES } from "@/lib/gear/crafting-ids";
import {
  activateCurrency,
  applyCurrencyToGear,
  bodyGear,
  confirmSalvage,
  currencyLocator,
  enterSalvageMode,
  equipmentSlotLocator,
  expectSalvageDialog,
  gearItemLocator,
  openArmory,
  salvageInventoryItem,
  selectArmorySlot,
} from "../armory";
import { createEmptyGearInventories, createEmptyGearLoadouts } from "@/lib/gear/types";
import { assertGearFlatDamageBoostsPhysicalDamage } from "../gear-combat";
import { seedRandom } from "../rng";
import { injectActiveBattle, makeGoblinBattleState, makeHighDamageCard } from "../../helpers";
import { MenuPage } from "../../pages/menu-page";
import { test } from "../../fixtures/e2e";
import { critical, slow } from "../../playwright-tags";

const affixedSword = {
  instanceId: "gear-sword",
  definitionId: "longsword-basic" as const,
  affixes: [{ id: "flat-physical" as const, value: 1 }],
};

const emptyCraftingCurrencies = { ...EMPTY_CRAFTING_CURRENCIES };

test.describe("Armory equip", critical, () => {
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

  test("keeps the battling hero browse-only while other heroes remain editable", async ({
    page,
    fastBattle,
    runtimeErrors,
  }) => {
    void fastBattle;
    void runtimeErrors;
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
    await bodyItem.getByRole("button", { name: "Leather Armor", exact: true }).click({ force: true });
    await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toBeVisible();
    await expect(equipmentSlotLocator(page, "body").locator("img")).toHaveCount(1);
    await page.getByRole("button", { name: "Rogue", exact: true }).click();
    await expect(page.getByText("Equipment cannot be changed during Combat.", { exact: true })).toHaveCount(0);
    await gearItemLocator(page, "Leather Armor").getByRole("button", { name: "Leather Armor", exact: true }).click();
    await expect(equipmentSlotLocator(page, "body").locator("img")).toHaveCount(2);
  });
});

test(
  "reserves shared equipment across reload and releases it after victory",
  critical,
  async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;
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

test.describe("Armory crafting", critical, () => {
  test.beforeEach(async ({ runtimeErrors }) => {
    void runtimeErrors;
  });

  test("salvages gear and grants crafting materials", async ({ page }) => {
    await seedRandom(page, 0);
    const sword = {
      instanceId: "gear-sword",
      definitionId: "shortsword-basic" as const,
      affixes: [{ id: "flat-physical" as const, value: 1 }],
    };

    await openArmory(page, {
      inventory: [sword],
      craftingCurrencies: { ...emptyCraftingCurrencies },
    });

    await salvageInventoryItem(page, "Shortsword");
    await expectSalvageDialog(page);
    await confirmSalvage(page);

    await expect(gearItemLocator(page, "Shortsword")).toHaveCount(0);
    await expect(currencyLocator(page, "discordant-dice")).toBeVisible();
    await expect
      .poll(async () => {
        const text = await currencyLocator(page, "discordant-dice").textContent();
        return Number(text?.trim() || "0");
      })
      .toBeGreaterThan(0);
  });

  test("returns to browsing after confirming a salvage", async ({ page }) => {
    await seedRandom(page, 0);
    const ringA = { instanceId: "ring-a", definitionId: "ruby-ring-basic" as const, affixes: [] };
    const ringB = { instanceId: "ring-b", definitionId: "ruby-ring-basic" as const, affixes: [] };

    await openArmory(page, {
      inventory: [ringA, ringB],
      craftingCurrencies: { ...emptyCraftingCurrencies },
    });

    await selectArmorySlot(page, "left-accessory");
    await enterSalvageMode(page);
    await page.getByLabel("Salvage Ruby Ring", { exact: true }).first().click();
    await expectSalvageDialog(page);
    await confirmSalvage(page);

    await expect(page.getByTestId("armory-salvage-toggle")).toHaveAttribute("aria-pressed", "false");
    await expect(gearItemLocator(page, "Ruby Ring")).toHaveCount(1);
  });

  test("voidstone targeting lifecycle and affix display", async ({ page }) => {
    await openArmory(page, {
      inventory: [affixedSword],
      craftingCurrencies: { ...emptyCraftingCurrencies, voidstone: 1 },
    });
    await gearItemLocator(page, "Longsword").hover();
    await expect(page.getByText("Ironbound")).toBeVisible();
    await expect(page.getByText("Increases Physical damage by 1")).toBeVisible();
    await activateCurrency(page, "voidstone");
    await expect(page.getByRole("button", { name: /Apply Voidstone to Longsword/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /Apply Voidstone/ })).toHaveCount(0);
    await activateCurrency(page, "voidstone");
    await applyCurrencyToGear(page, "Longsword", "Voidstone");
    await expect(page.getByTestId("armory-crafting-cursor")).toHaveCount(0);
    await expect(currencyLocator(page, "voidstone")).toContainText("0");
    await expect(page.getByTestId("armory-crafting-result")).toContainText("Removed");
    await page.getByRole("button", { name: "Dismiss result" }).click();
    await gearItemLocator(page, "Longsword").hover();
    await expect(page.getByText("Ironbound")).toHaveCount(0);
  });

  test("rejects invalid voidstone target without consuming currency", async ({ page }) => {
    await openArmory(page, {
      inventory: [bodyGear],
      craftingCurrencies: { ...emptyCraftingCurrencies, voidstone: 1 },
    });
    await selectArmorySlot(page, "body");
    await activateCurrency(page, "voidstone");
    await gearItemLocator(page, "Leather Armor").click();
    await expect(currencyLocator(page, "voidstone")).toContainText("1");
    await expect(currencyLocator(page, "voidstone")).toHaveAttribute("aria-pressed", "true");
  });

  test("upgrades basic gear to astral with ascension seal", slow, async ({ page }) => {
    await openArmory(page, {
      inventory: [affixedSword],
      craftingCurrencies: { ...emptyCraftingCurrencies, "ascension-seal": 1 },
    });

    await activateCurrency(page, "ascension-seal");
    await applyCurrencyToGear(page, "Longsword", "Ascension Seal");

    await expect(gearItemLocator(page, "Astral Longsword")).toBeVisible();
    await expect(gearItemLocator(page, "Longsword")).toHaveCount(0);
  });
});

test.describe("Gear combat", critical, () => {
  test("equipped gear increases physical damage in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await assertGearFlatDamageBoostsPhysicalDamage(page, {
      instanceId: "gear-1",
      definitionId: "longsword-basic",
      slot: "main-hand",
      affixes: [{ id: "flat-physical", value: 1 }],
    });
  });
});
