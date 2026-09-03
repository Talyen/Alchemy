import { expect, type Page } from "@playwright/test";
import { openingPacedDamage } from "@/lib/battle/fight-pacing";
import type { GearAffixRoll } from "@/lib/gear";
import { createEmptyGearInventories, createEmptyGearLoadouts } from "./armory";
import { startBattleWithDeck } from "./battle-setup";
import { makeCard } from "./cards";
import { seedRandom } from "./rng";
import { BattlePage } from "../pages/battle-page";
import { MenuPage } from "../pages/menu-page";

interface GearSlotSetup {
  instanceId: string;
  definitionId: string;
  slot: string;
  affixes: Array<{ id: string; value: number }>;
}

export async function assertGearFlatDamageBoostsPhysicalDamage(page: Page, gear: GearSlotSetup) {
  await seedRandom(page, 42);

  const loadouts = createEmptyGearLoadouts();
  (loadouts.knight as Record<string, string | null>)[gear.slot] = gear.instanceId;
  const gearInventories = createEmptyGearInventories();
  gearInventories.knight = [{ ...gear, affixes: gear.affixes as GearAffixRoll[] }];

  const menu = new MenuPage(page);
  await menu.gotoWithUnlockedMeta({
    gearInventories,
    gearLoadouts: loadouts,
  });

  const physicalCard = makeCard({
    id: "slash",
    title: "Test Slash",
    cost: 0,
    effects: [{ kind: "damage", damageType: "physical", amount: 5 }],
  });

  await startBattleWithDeck(
    page,
    Array.from({ length: 6 }, () => physicalCard),
    {
      rng: { seed: 42, counters: { rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 } },

      encounteredRunEnemyIds: ["slime", "skeleton"],
    },
  );

  const battle = new BattlePage(page);
  const enemyHpBefore = await battle.enemyHealth();
  await battle.playCardNamed("Slash");

  const flatBonus = gear.affixes.find((a) => a.id === "flat-physical")?.value ?? 0;
  const expectedDamage = openingPacedDamage(5 + flatBonus);
  await expect(async () => {
    expect(await battle.enemyHealth()).toBe(enemyHpBefore - expectedDamage);
  }).toPass({ timeout: 5000 });
}
