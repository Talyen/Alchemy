import {
  GEAR_AFFIX_COUNT,
  SALVAGE_ADVANCED_MAW_CHANCE,
  SALVAGE_ADVANCED_SEAL_CHANCE,
  SALVAGE_ADVANCED_WHETSTONE_CHANCE,
  SALVAGE_BASIC_SPRIG_CHANCE,
  SALVAGE_BASIC_VOIDSTONE_CHANCE,
  SALVAGE_DICE_HIGH_CHANCE,
} from "@/lib/game-constants";
import { craftingArt } from "@/lib/game-data";
import { buildEligibleAffixPool, rollAffixes } from "./generation";
import { rollAffixValue } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { gearDefinitionId, gearDefinitions, gearInstanceRarity } from "./definitions";
import { type GearInstance, type GearAffixRoll, type GearRarity } from "./types";
import { clamp, lerp } from "@/lib/math";
import { pickRandom } from "@/lib/utils";
import { EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "./crafting-ids";

export type { CraftingCurrencyId } from "./crafting-ids";
export { EMPTY_CRAFTING_CURRENCIES } from "./crafting-ids";
export { addCraftingCurrencies, normalizeCraftingCurrencies } from "./crafting-ids";

export interface CraftingCurrencyDefinition {
  id: CraftingCurrencyId;
  displayName: string;
  description: string;
  tooltipEffect: string;
  art: string;
}

export const CRAFTING_CURRENCY_LIST: CraftingCurrencyDefinition[] = [
  {
    id: "discordant-dice",
    displayName: "Discordant Dice",
    tooltipEffect: "Reroll All Affixes",
    description: "Rerolls all affixes using normal affinity rules.",
    art: craftingArt["discordant-dice"]!,
  },
  {
    id: "sprig-of-growth",
    displayName: "Sprig of Growth",
    tooltipEffect: "Add a Random Affix",
    description: "Adds a random affix using normal affinity rules.",
    art: craftingArt["sprig-of-growth"]!,
  },
  {
    id: "voidstone",
    displayName: "Voidstone",
    tooltipEffect: "Remove All Affixes",
    description: "Removes all affixes from an item.",
    art: craftingArt.voidstone!,
  },
  {
    id: "ascension-seal",
    displayName: "Ascension Seal",
    tooltipEffect: "Upgrades an item to Astral quality",
    description: "Upgrades a Basic item and its existing affixes to Astral quality.",
    art: craftingArt["ascension-seal"]!,
  },
  {
    id: "severance-maw",
    displayName: "Severance Maw",
    tooltipEffect: "Removes a Random Affix",
    description: "Removes a random affix from an item.",
    art: craftingArt["severance-maw"]!,
  },
  {
    id: "smiths-whetstone",
    displayName: "Smith's Whetstone",
    tooltipEffect: "Upgrades a Random Affix",
    description: "Increases a random affix value by 1.",
    art: craftingArt["smiths-whetstone"]!,
  },
];

const CRAFTING_CURRENCIES_BY_ID: Record<CraftingCurrencyId, CraftingCurrencyDefinition> = Object.fromEntries(
  CRAFTING_CURRENCY_LIST.map((currency) => [currency.id, currency]),
) as Record<CraftingCurrencyId, CraftingCurrencyDefinition>;

export function getCraftingCurrencyDefinition(id: CraftingCurrencyId): CraftingCurrencyDefinition {
  const definition = CRAFTING_CURRENCIES_BY_ID[id];
  if (!definition) throw new Error(`Unknown crafting currency: ${id}`);
  return definition;
}

function addRandomAffix(item: GearInstance, rng: () => number): GearInstance {
  const def = gearDefinitions[item.definitionId];
  if (!def) return item;
  const rarity = gearInstanceRarity(item) ?? "basic";
  const available = availableAffixesForItem(item);
  const chosen = pickRandom(available, rng);
  if (!chosen) return item;
  return {
    ...item,
    affixes: [...item.affixes, { id: chosen.id, value: rollAffixValue(chosen, rarity, rng) }],
  };
}

function availableAffixesForItem(item: GearInstance) {
  const def = gearDefinitions[item.definitionId];
  if (!def) return [];
  const presentIds = new Set(item.affixes.map((affix) => affix.id));
  return buildEligibleAffixPool(def).filter((affix) => !presentIds.has(affix.id));
}

function affixMaxValue(roll: GearAffixRoll, rarity: GearRarity): number {
  const def = gearAffixCatalog[roll.id];
  return def ? def.roll[rarity].max : roll.value;
}

function hasUpgradeableAffix(item: GearInstance): boolean {
  const rarity = gearInstanceRarity(item) ?? "basic";
  return item.affixes.some((affix) => affix.value < affixMaxValue(affix, rarity));
}

function upgradeAffixValueToAstral(roll: GearAffixRoll): GearAffixRoll {
  const def = gearAffixCatalog[roll.id];
  if (!def) return roll;
  const basic = def.roll.basic;
  const astral = def.roll.astral;
  const basicSpan = Math.max(1, basic.max - basic.min);
  const progress = clamp((roll.value - basic.min) / basicSpan, 0, 1);
  return {
    ...roll,
    value: clamp(Math.round(lerp(astral.min, astral.max, progress)), astral.min, astral.max),
  };
}

function hasAnyAffix(item: GearInstance): boolean {
  return item.affixes.length > 0;
}

interface CraftingCurrencyBehavior {
  canApply(item: GearInstance): boolean;
  apply(item: GearInstance, rng: () => number): GearInstance;
}

const CRAFTING_CURRENCY_BEHAVIORS: Record<CraftingCurrencyId, CraftingCurrencyBehavior> = {
  "discordant-dice": {
    canApply: hasAnyAffix,
    apply: (item, rng) => {
      const def = gearDefinitions[item.definitionId];
      return { ...item, affixes: def ? rollAffixes(def, item.affixes.length, rng) : [] };
    },
  },
  "sprig-of-growth": {
    canApply: (item) => {
      const rarity = gearInstanceRarity(item);
      if (!rarity) return false;
      return item.affixes.length < GEAR_AFFIX_COUNT[rarity].max && availableAffixesForItem(item).length > 0;
    },
    apply: addRandomAffix,
  },
  voidstone: {
    canApply: hasAnyAffix,
    apply: (item) => ({ ...item, affixes: [] }),
  },
  "ascension-seal": {
    canApply: (item) => {
      if (gearInstanceRarity(item) !== "basic") return false;
      const baseItemId = gearDefinitions[item.definitionId]?.baseItemId;
      return baseItemId !== undefined && gearDefinitions[gearDefinitionId(baseItemId, "astral")] !== undefined;
    },
    apply: (item) => {
      const def = gearDefinitions[item.definitionId];
      const baseItemId = def?.baseItemId;
      if (baseItemId === undefined) return item;
      const nextDefId = gearDefinitionId(baseItemId, "astral");
      if (!gearDefinitions[nextDefId]) return item;
      return { ...item, definitionId: nextDefId, affixes: item.affixes.map(upgradeAffixValueToAstral) };
    },
  },
  "severance-maw": {
    canApply: hasAnyAffix,
    apply: (item, rng) => {
      if (item.affixes.length === 0) return item;
      const index = Math.floor(rng() * item.affixes.length);
      return { ...item, affixes: item.affixes.filter((_, affixIndex) => affixIndex !== index) };
    },
  },
  "smiths-whetstone": {
    canApply: (item) => hasAnyAffix(item) && hasUpgradeableAffix(item),
    apply: (item, rng) => {
      const rarity = gearInstanceRarity(item) ?? "basic";
      const upgradeableIndexes = item.affixes.flatMap((affix, index) =>
        affix.value < affixMaxValue(affix, rarity) ? [index] : [],
      );
      const index = pickRandom(upgradeableIndexes, rng);
      if (index === undefined) return item;
      return {
        ...item,
        affixes: item.affixes.map((affix, affixIndex) =>
          affixIndex === index ? { ...affix, value: affix.value + 1 } : affix,
        ),
      };
    },
  },
};

export function canApplyCraftingCurrency(currencyId: CraftingCurrencyId, item: GearInstance): boolean {
  if (gearInstanceRarity(item) === "unique") return false;
  return CRAFTING_CURRENCY_BEHAVIORS[currencyId].canApply(item);
}

export function applyCraftingCurrency(
  currencyId: CraftingCurrencyId,
  item: GearInstance,
  rng: () => number,
): GearInstance {
  if (gearInstanceRarity(item) === "unique") return item;
  const behavior = CRAFTING_CURRENCY_BEHAVIORS[currencyId];
  if (!behavior.canApply(item)) return item;
  return behavior.apply(item, rng);
}

export function rollSalvageYield(rarity: GearRarity, rng: () => number): Record<CraftingCurrencyId, number> {
  const yieldRecord = { ...EMPTY_CRAFTING_CURRENCIES };

  if (rarity === "unique") {
    yieldRecord["discordant-dice"] = 2;
    yieldRecord["ascension-seal"] = 1;
    yieldRecord["severance-maw"] = 1;
    yieldRecord["smiths-whetstone"] = 1;
    return yieldRecord;
  }

  yieldRecord["discordant-dice"] = rng() < SALVAGE_DICE_HIGH_CHANCE ? 2 : 1;
  if (rarity === "basic") {
    if (rng() < SALVAGE_BASIC_SPRIG_CHANCE) yieldRecord["sprig-of-growth"] = 1;
    if (rng() < SALVAGE_BASIC_VOIDSTONE_CHANCE) yieldRecord.voidstone = 1;
  } else {
    if (rng() < SALVAGE_ADVANCED_SEAL_CHANCE) yieldRecord["ascension-seal"] = 1;
    if (rng() < SALVAGE_ADVANCED_MAW_CHANCE) yieldRecord["severance-maw"] = 1;
    if (rng() < SALVAGE_ADVANCED_WHETSTONE_CHANCE) yieldRecord["smiths-whetstone"] = 1;
  }

  return yieldRecord;
}

export interface SalvageYield {
  currencies: Record<CraftingCurrencyId, number>;
  materials: MaterialInventory;
}

function homesteadSalvageYield(instance: GearInstance): MaterialInventory {
  const salvageValue = gearDefinitions[instance.definitionId]?.salvageValue;
  return salvageValue ? { ...salvageValue } : emptyInventory();
}

export function computeSalvageYield(instance: GearInstance, rng: () => number): SalvageYield {
  return {
    currencies: rollSalvageYield(gearInstanceRarity(instance) ?? "basic", rng),
    materials: homesteadSalvageYield(instance),
  };
}
