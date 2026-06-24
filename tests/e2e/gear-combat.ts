import { expect, type Page } from "@playwright/test";
import { createEmptyGearLoadouts } from "./armory";
import { startBattleWithDeck } from "./battle-setup";
import { makeCard } from "./cards";
import { BattlePage } from "../pages/battle-page";
import { MenuPage } from "../pages/menu-page";

interface GearSlotSetup {
  instanceId: string;
  definitionId: string;
  slot: string;
  affixes: Array<{ id: string; value: number }>;
}

export async function assertGearFlatDamageBoostsPhysicalDamage(page: Page, gear: GearSlotSetup) {
  const loadouts = createEmptyGearLoadouts();
  (loadouts.knight as Record<string, string | null>)[gear.slot] = gear.instanceId;

  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({
    gearInventory: [gear],
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

  const flatBonus = gear.affixes.find((a) => a.id === "flat-physical")?.value ?? 0;
  await expect(async () => {
    expect(await battle.enemyHealth()).toBe(enemyHpBefore - (5 + flatBonus));
  }).toPass({ timeout: 5000 });
}
