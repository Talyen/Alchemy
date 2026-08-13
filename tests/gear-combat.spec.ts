import { expect } from "@playwright/test";
import { bodyGear, createEmptyGearInventories, createEmptyGearLoadouts, gearItemLocator } from "./e2e/armory";
import { assertGearFlatDamageBoostsPhysicalDamage } from "./e2e/gear-combat";
import { makeGoblinBattleState, injectSaveState } from "./helpers";
import { MenuPage } from "./pages/menu-page";
import { test } from "./fixtures/e2e";
import { armory, critical } from "./playwright-tags";

test.describe("Gear combat", { ...armory, ...critical }, () => {
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

  test("keeps Armory editing disabled while a battle is active", async ({ page, fastBattle }) => {
    void fastBattle;
    const gearInventories = createEmptyGearInventories();
    gearInventories.knight = [bodyGear];
    const menu = new MenuPage(page);

    // Inject the meta gear first (its init script must run before the battle
    // save's), then an in-battle screen so the Armory-lock gate is reachable
    // without booting a full battle. injectSaveState preserves existing
    // localStorage (gear) and adds the active run + combat snapshot.
    await menu.gotoWithUnlockedMeta({
      gearInventories,
      gearLoadouts: createEmptyGearLoadouts(),
    });
    await injectSaveState(page, {
      currentScreen: "battle",
      activeCombat: {
        battleState: makeGoblinBattleState(),
        activeLabyrinthModifiers: [],
        activeLabyrinthRewardModifiers: [],
      },
    });
    await page.goto("/");

    await page.getByRole("button", { name: "Open battle menu" }).click();
    await page.getByRole("button", { name: "Armory" }).click();
    await expect(page.getByText("Equipment can be changed after combat.")).toBeVisible();
    await page.getByLabel("Armor equipment slot").click();
    const bodyItem = gearItemLocator(page, "Leather Armor");
    await expect(bodyItem).toBeVisible();
    await bodyItem.dblclick();
    await expect(page.locator('[data-testid="armory-equipment-slot"][data-slot="body"] img')).toHaveCount(1);
  });
});
