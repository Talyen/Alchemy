import {
  GEAR_AFFIX_COUNT,
  SALVAGE_ADVANCED_MAW_CHANCE,
  SALVAGE_ADVANCED_SEAL_CHANCE,
  SALVAGE_ADVANCED_WHETSTONE_CHANCE,
  SALVAGE_BASIC_SPRIG_CHANCE,
  SALVAGE_BASIC_VOIDSTONE_CHANCE,
  SALVAGE_DICE_HIGH_CHANCE,
} from "@/lib/game-constants";
import craftingAscensionSeal from "@/assets/optimized/crafting-ascension-seal.webp";
import craftingDiscordantDice from "@/assets/optimized/crafting-discordant-dice.webp";
import craftingSeveranceMaw from "@/assets/optimized/crafting-severance-maw.webp";
import craftingSmithsWhetstone from "@/assets/optimized/crafting-smiths-whetstone.webp";
import craftingSprigOfGrowth from "@/assets/optimized/crafting-sprig-of-growth.webp";
import craftingVoidstone from "@/assets/optimized/crafting-voidstone.webp";
import { buildEligibleAffixPool, rollAffixes } from "./generation";
import { rollAffixValue } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { gearDefinitionId, gearDefinitions, gearInstanceRarity } from "./definitions";
import { type GearInstance, type GearAffixRoll, type GearRarity } from "./types";
import { pickRandom } from "@/lib/utils";

export type CraftingCurrencyId =
  | "discordant-dice"
  | "sprig-of-growth"
  | "voidstone"
  | "ascension-seal"
  | "severance-maw"
  | "smiths-whetstone";

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
    art: craftingDiscordantDice,
  },
  {
    id: "sprig-of-growth",
    displayName: "Sprig of Growth",
    tooltipEffect: "Add a Random Affix",
    description: "Adds a random affix using normal affinity rules.",
    art: craftingSprigOfGrowth,
  },
  {
    id: "voidstone",
    displayName: "Voidstone",
    tooltipEffect: "Remove All Affixes",
    description: "Removes all affixes from an item.",
    art: craftingVoidstone,
  },
  {
    id: "ascension-seal",
    displayName: "Ascension Seal",
    tooltipEffect: "Upgrades an item to Astral quality",
    description: "Upgrades a Basic item and its existing affixes to Astral quality.",
    art: craftingAscensionSeal,
  },
  {
    id: "severance-maw",
    displayName: "Severance Maw",
    tooltipEffect: "Removes a Random Affix",
    description: "Removes a random affix from an item.",
    art: craftingSeveranceMaw,
  },
  {
    id: "smiths-whetstone",
    displayName: "Smith's Whetstone",
    tooltipEffect: "Upgrades a Random Affix",
    description: "Increases a random affix value by 1.",
    art: craftingSmithsWhetstone,
  },
];

const CRAFTING_CURRENCY_IDS = CRAFTING_CURRENCY_LIST.map(({ id }) => id) as [
  CraftingCurrencyId,
  ...CraftingCurrencyId[],
];

export const EMPTY_CRAFTING_CURRENCIES = Object.fromEntries(CRAFTING_CURRENCY_IDS.map((id) => [id, 0])) as Record<
  CraftingCurrencyId,
  number
>;

export function normalizeCraftingCurrencies(
  currencies: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  const normalized = { ...EMPTY_CRAFTING_CURRENCIES };
  if (!currencies || typeof currencies !== "object") return normalized;

  for (const id of CRAFTING_CURRENCY_IDS) {
    const value = currencies[id];
    normalized[id] = typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  return normalized;
}

export function addCraftingCurrencies(
  base: Partial<Record<string, unknown>> | null | undefined,
  added: Partial<Record<string, unknown>> | null | undefined,
): Record<CraftingCurrencyId, number> {
  const next = normalizeCraftingCurrencies(base);
  if (!added || typeof added !== "object") return next;

  for (const id of CRAFTING_CURRENCY_IDS) {
    const value = added[id];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[id] += Math.floor(value);
    }
  }

  return next;
}

export function getCraftingCurrencyDefinition(id: CraftingCurrencyId): CraftingCurrencyDefinition {
  return CRAFTING_CURRENCY_LIST.find((currency) => currency.id === id) ?? CRAFTING_CURRENCY_LIST[0]!;
}

function rollDistinctAffixes(item: GearInstance, count: number, rng: () => number): GearAffixRoll[] {
  const def = gearDefinitions[item.definitionId];
  if (!def) return [];
  return rollAffixes(def, count, rng);
}

function addRandomAffix(item: GearInstance, rng: () => number): GearInstance {
  const def = gearDefinitions[item.definitionId];
  if (!def) return item;
  const rarity = gearInstanceRarity(item);
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
  const rarity = gearInstanceRarity(item);
  return item.affixes.some((affix) => affix.value < affixMaxValue(affix, rarity));
}

function upgradeAffixValueToAstral(roll: GearAffixRoll): GearAffixRoll {
  const def = gearAffixCatalog[roll.id];
  if (!def) return roll;
  const basic = def.roll.basic;
  const astral = def.roll.astral;
  const basicSpan = Math.max(1, basic.max - basic.min);
  const astralSpan = astral.max - astral.min;
  const progress = Math.max(0, Math.min(1, (roll.value - basic.min) / basicSpan));
  return {
    ...roll,
    value: Math.max(astral.min, Math.min(astral.max, Math.round(astral.min + progress * astralSpan))),
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
    apply: (item, rng) => ({ ...item, affixes: rollDistinctAffixes(item, item.affixes.length, rng) }),
  },
  "sprig-of-growth": {
    canApply: (item) =>
      item.affixes.length < GEAR_AFFIX_COUNT[gearInstanceRarity(item)].max && availableAffixesForItem(item).length > 0,
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
      const baseItemId = gearDefinitions[item.definitionId]!.baseItemId;
      const nextDefId = gearDefinitionId(baseItemId, "astral");
      if (!gearDefinitions[nextDefId]) return item;
      return { ...item, definitionId: nextDefId, affixes: item.affixes.map(upgradeAffixValueToAstral) };
    },
  },
  "severance-maw": {
    canApply: hasAnyAffix,
    apply: (item, rng) => {
      const index = Math.floor(rng() * item.affixes.length);
      return { ...item, affixes: item.affixes.filter((_, affixIndex) => affixIndex !== index) };
    },
  },
  "smiths-whetstone": {
    canApply: (item) => hasAnyAffix(item) && hasUpgradeableAffix(item),
    apply: (item, rng) => {
      const rarity = gearInstanceRarity(item);
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
  return CRAFTING_CURRENCY_BEHAVIORS[currencyId].canApply(item);
}

export function applyCraftingCurrency(
  currencyId: CraftingCurrencyId,
  item: GearInstance,
  rng: () => number,
): GearInstance {
  const behavior = CRAFTING_CURRENCY_BEHAVIORS[currencyId];
  if (!behavior.canApply(item)) return item;
  return behavior.apply(item, rng);
}

export function rollSalvageYield(rarity: GearRarity, rng: () => number): Record<CraftingCurrencyId, number> {
  const yieldRecord = { ...EMPTY_CRAFTING_CURRENCIES };

  yieldRecord["discordant-dice"] = rng() < SALVAGE_DICE_HIGH_CHANCE ? 1 : 2;
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
    currencies: rollSalvageYield(gearInstanceRarity(instance), rng),
    materials: homesteadSalvageYield(instance),
  };
}
