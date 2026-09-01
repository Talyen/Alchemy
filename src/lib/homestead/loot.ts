import { MATERIAL_IDS, type MaterialId, type MaterialInventory } from "./types";
import type { HomesteadEffectManifest } from "./types";
import { addInventory, emptyInventory, materialAmount } from "./inventory";
import { materialCost } from "./costs";
import { HOMESTEAD_LOOT_CONFIG } from "../game-constants";

interface MaterialLootEntry {
  material: MaterialId;
  min: number;
  max: number;
  weight: number;
}

interface EnemyLootTable {
  guaranteed: MaterialInventory;
  bonuses: MaterialLootEntry[];
}

function lootEntry(material: MaterialId, min: number, max: number, weight = 1): MaterialLootEntry {
  return { material, min, max, weight };
}

const enemyLootTables: Record<string, EnemyLootTable> = {
  skeleton: {
    guaranteed: emptyInventory(),
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
  goblin: {
    guaranteed: materialCost({ wood: 1, food: 1 }),
    bonuses: [lootEntry("wood", 0, 1, 0.4)],
  },
  mimic: {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("gems", 0, 1, 0.5), lootEntry("iron", 0, 1, 0.4)],
  },
  "mud-elemental": {
    guaranteed: materialCost({ herbs: 1 }),
    bonuses: [],
  },
  necromancer: {
    guaranteed: materialCost({ herbs: 2, gems: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.3), lootEntry("herbs", 0, 1, 0.5)],
  },
  "plague-doctor": {
    guaranteed: materialCost({ herbs: 2 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.4)],
  },
  "forge-golem": {
    guaranteed: materialCost({ iron: 3, gems: 1 }),
    bonuses: [lootEntry("iron", 0, 2, 0.6), lootEntry("gems", 0, 1, 0.4)],
  },
  frostwarden: {
    guaranteed: materialCost({ gems: 3 }),
    bonuses: [lootEntry("gems", 0, 2, 0.6), lootEntry("iron", 0, 1, 0.3)],
  },
  "blight-treant": {
    guaranteed: materialCost({ wood: 2, herbs: 2 }),
    bonuses: [lootEntry("wood", 0, 2, 0.6), lootEntry("herbs", 0, 2, 0.5)],
  },
  "living-armor": {
    guaranteed: materialCost({ iron: 2 }),
    bonuses: [lootEntry("iron", 0, 1, 0.4), lootEntry("gems", 0, 1, 0.3)],
  },
  "iron-bear": {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 0, 2, 0.5), lootEntry("food", 0, 1, 0.4)],
  },
  "fire-elemental": {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.4)],
  },
  "frost-elemental": {
    guaranteed: materialCost({ gems: 2 }),
    bonuses: [lootEntry("gems", 0, 1, 0.6)],
  },
  slime: {
    guaranteed: materialCost({ food: 1 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.3)],
  },
  "will-o-wisp": {
    guaranteed: materialCost({ gems: 2 }),
    bonuses: [lootEntry("gems", 0, 1, 0.6)],
  },
  bandit: {
    guaranteed: materialCost({ wood: 1, food: 1 }),
    bonuses: [lootEntry("wood", 0, 1, 0.4)],
  },
  ogre: {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 0, 1, 0.5)],
  },
  "fire-imp": {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.4)],
  },
  hellhound: {
    guaranteed: materialCost({ food: 2, iron: 1 }),
    bonuses: [lootEntry("food", 0, 1, 0.4)],
  },
  pyromancer: {
    guaranteed: materialCost({ gems: 2, iron: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.5)],
  },
  "giant-spider": {
    guaranteed: materialCost({ herbs: 1, food: 1 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.5)],
  },
  "giant-snake": {
    guaranteed: materialCost({ herbs: 2 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.5)],
  },
  "blood-cultist": {
    guaranteed: materialCost({ herbs: 2, gems: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.4)],
  },
  "dire-wolf": {
    guaranteed: materialCost({ food: 2 }),
    bonuses: [lootEntry("food", 0, 1, 0.5)],
  },
  vampire: {
    guaranteed: materialCost({ herbs: 2, food: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.4)],
  },
  "blood-countess": {
    guaranteed: materialCost({ herbs: 3, gems: 1 }),
    bonuses: [lootEntry("herbs", 0, 2, 0.6), lootEntry("gems", 0, 1, 0.4)],
  },
  zealot: {
    guaranteed: materialCost({ food: 1, gems: 1 }),
    bonuses: [lootEntry("food", 0, 1, 0.4)],
  },
  cleric: {
    guaranteed: materialCost({ herbs: 1, gems: 1 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.4)],
  },
  inquisitor: {
    guaranteed: materialCost({ iron: 1, gems: 1 }),
    bonuses: [lootEntry("iron", 0, 1, 0.4)],
  },
  paladin: {
    guaranteed: materialCost({ iron: 2, gems: 1 }),
    bonuses: [lootEntry("iron", 0, 1, 0.5)],
  },
  seraph: {
    guaranteed: materialCost({ gems: 3, herbs: 1 }),
    bonuses: [lootEntry("gems", 0, 2, 0.6), lootEntry("herbs", 0, 1, 0.4)],
  },
  "winter-wolf": {
    guaranteed: materialCost({ food: 1, gems: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.4)],
  },
  "ice-wraith": {
    guaranteed: materialCost({ gems: 2, herbs: 1 }),
    bonuses: [lootEntry("gems", 0, 1, 0.5)],
  },
  yeti: {
    guaranteed: materialCost({ food: 2, iron: 1 }),
    bonuses: [lootEntry("food", 0, 1, 0.4)],
  },
  banshee: {
    guaranteed: materialCost({ herbs: 1, gems: 1 }),
    bonuses: [lootEntry("herbs", 0, 1, 0.4)],
  },
  brawler: {
    guaranteed: materialCost({ iron: 2, food: 1 }),
    bonuses: [lootEntry("iron", 0, 1, 0.5)],
  },
  "stone-golem": {
    guaranteed: materialCost({ iron: 3 }),
    bonuses: [lootEntry("iron", 0, 2, 0.5)],
  },
  "earth-elemental": {
    guaranteed: materialCost({ iron: 1, herbs: 1 }),
    bonuses: [lootEntry("iron", 0, 1, 0.4)],
  },
  "stone-titan": {
    guaranteed: materialCost({ iron: 3, gems: 1 }),
    bonuses: [lootEntry("iron", 0, 2, 0.6), lootEntry("gems", 0, 1, 0.4)],
  },
};

export const enemyLootTableIds = Object.keys(enemyLootTables);

function rollBonuses(table: EnemyLootTable, rng: () => number): MaterialInventory {
  const result = emptyInventory();
  for (const bonus of table.bonuses) {
    if (rng() < bonus.weight) {
      result[bonus.material] = bonus.min + Math.floor(rng() * (bonus.max - bonus.min + 1));
    }
  }
  return result;
}

function applyTypeMultiplier(loot: MaterialInventory, enemyType: string): MaterialInventory {
  const { enemyTypeMultipliers } = HOMESTEAD_LOOT_CONFIG;
  const multiplier =
    enemyType === "boss"
      ? enemyTypeMultipliers.boss
      : enemyType === "elite"
        ? enemyTypeMultipliers.elite
        : enemyTypeMultipliers.normal;
  if (multiplier === enemyTypeMultipliers.normal) return loot;
  const result = { ...loot };
  for (const mat of MATERIAL_IDS) {
    result[mat] = Math.floor(materialAmount(result, mat) * multiplier);
  }
  return result;
}

export function getEnemyMaterialLoot(enemyId: string, enemyType: string, rng: () => number): MaterialInventory {
  const table = enemyLootTables[enemyId];
  if (!table) return emptyInventory();
  const guaranteed = { ...table.guaranteed };
  const bonuses = rollBonuses(table, rng);
  const combined = addInventory(guaranteed, bonuses);
  return applyTypeMultiplier(combined, enemyType);
}

export function applyMaterialFindBonus(
  materials: MaterialInventory,
  effects: Pick<HomesteadEffectManifest, "herbFindBonus">,
): MaterialInventory {
  if (effects.herbFindBonus <= 0 || materials.herbs <= 0) return materials;
  return { ...materials, herbs: Math.floor(materials.herbs * (1 + effects.herbFindBonus)) };
}

type EndOfRunHomesteadEffects = Pick<
  HomesteadEffectManifest,
  "endRunFoodPerRoom" | "endRunHerbsPerRoom" | "endRunGemsPerRoom" | "herbFindBonus"
>;

export function applyEndOfRunHomesteadBonuses(
  base: MaterialInventory,
  effects: EndOfRunHomesteadEffects,
  roomsEncountered: number,
): MaterialInventory {
  const withFlatYields = {
    ...base,
    herbs: base.herbs + effects.endRunHerbsPerRoom * roomsEncountered,
    food: base.food + effects.endRunFoodPerRoom * roomsEncountered,
    gems: base.gems + effects.endRunGemsPerRoom * roomsEncountered,
  };
  return applyMaterialFindBonus(withFlatYields, effects);
}
