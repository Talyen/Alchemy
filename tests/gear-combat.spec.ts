import { expect } from "@playwright/test";
import { bodyGear, createEmptyGearLoadouts, gearItemLocator } from "./e2e/armory";
import { assertGearFlatDamageBoostsPhysicalDamage } from "./e2e/gear-combat";
import { startBattleWithDeck } from "./e2e/battle-setup";
import { makeCard } from "./e2e/cards";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";
import { armory, critical } from "./playwright-tags";

test.describe("Gear combat", { ...armory, ...critical }, () => {
  test("equipped gear increases physical damage in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    await assertGearFlatDamageBoostsPhysicalDamage(page, {
      instanceId: "gear-1",
      definitionId: "leather-armor-basic",
      slot: "body",
      affixes: [{ id: "flat-physical", value: 1 }],
    });
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
});
