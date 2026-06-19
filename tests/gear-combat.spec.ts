import { expect } from "@playwright/test";
import {
  bodyGear,
  createEmptyGearLoadouts,
  gearItemLocator,
} from "./e2e/armory";
import { startBattleWithDeck } from "./e2e/battle-setup";
import { makeCard } from "./e2e/cards";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";

test.describe("Gear combat", () => {
  test("equipped gear increases physical damage in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-1";

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
