import { expect } from "@playwright/test";
import { createEmptyGearLoadouts } from "@/lib/gear";
import { makeCard, startBattleWithDeck } from "./helpers";
import { BattlePage } from "./pages/battle-page";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";

test.describe("Gear flow", () => {
  test("equipped gear increases physical damage in battle", async ({ page, fastBattle, runtimeErrors }) => {
    void fastBattle;
    void runtimeErrors;

    const loadouts = createEmptyGearLoadouts();
    loadouts.knight.body = "gear-1";

    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      gearInventory: [{ instanceId: "gear-1", definitionId: "placeholder-body", modifiers: [] }],
      gearLoadouts: loadouts,
    });

    const physicalCard = makeCard({
      id: "test-slash",
      title: "Test Slash",
      cost: 0,
      effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });

    await startBattleWithDeck(page, Array.from({ length: 6 }, () => physicalCard));

    const battle = new BattlePage(page);
    const enemyHpBefore = await battle.enemyHealth();
    await battle.playCardNamed("Test Slash");

    await expect(async () => {
      expect(await battle.enemyHealth()).toBe(enemyHpBefore - 6);
    }).toPass({ timeout: 5000 });
  });

  test("armory screen opens from the main menu", async ({ page }) => {
    const menu = new MenuPage(page);
    await menu.gotoWithUnlockedMeta({
      gearInventory: [{ instanceId: "gear-1", definitionId: "placeholder-body", modifiers: [] }],
      gearLoadouts: createEmptyGearLoadouts(),
    });

    await page.getByRole("button", { name: "Armory" }).click();
    await expect(page.getByRole("heading", { name: "Armory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  });
});
