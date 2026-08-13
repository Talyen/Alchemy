import { GEAR_AFFIX_COUNT } from "@/lib/game-constants";
import craftingAscensionSeal from "@/assets/optimized/crafting-ascension-seal.webp";
import craftingDiscordantDice from "@/assets/optimized/crafting-discordant-dice.webp";
import craftingSeveranceMaw from "@/assets/optimized/crafting-severance-maw.webp";
import craftingSmithsWhetstone from "@/assets/optimized/crafting-smiths-whetstone.webp";
import craftingSprigOfGrowth from "@/assets/optimized/crafting-sprig-of-growth.webp";
import craftingVoidstone from "@/assets/optimized/crafting-voidstone.webp";
import { buildEligibleAffixPool } from "./generation";
import { rollAffixValue } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { gearDefinitions, gearInstanceRarity } from "./definitions";
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

export const CRAFTING_CURRENCY_IDS = CRAFTING_CURRENCY_LIST.map(({ id }) => id) as [
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
  const rarity = gearInstanceRarity(item);
  const remaining = [...buildEligibleAffixPool(def)];
  const affixes: GearAffixRoll[] = [];
  while (affixes.length < count && remaining.length > 0) {
    const index = Math.floor(rng() * remaining.length);
    const [chosen] = remaining.splice(index, 1);
    if (!chosen) break;
    affixes.push({ id: chosen.id, value: rollAffixValue(chosen, rarity, rng) });
  }
  return affixes;
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
  return gearAffixCatalog[roll.id].roll[rarity].max;
}

function hasUpgradeableAffix(item: GearInstance): boolean {
  const rarity = gearInstanceRarity(item);
  return item.affixes.some((affix) => affix.value < affixMaxValue(affix, rarity));
}

function upgradeAffixValueToAstral(roll: GearAffixRoll): GearAffixRoll {
  const def = gearAffixCatalog[roll.id];
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

export function canApplyCraftingCurrency(currencyId: CraftingCurrencyId, item: GearInstance): boolean {
  const rarity = gearInstanceRarity(item);
  switch (currencyId) {
    case "discordant-dice":
      return item.affixes.length > 0;
    case "sprig-of-growth":
      return item.affixes.length < GEAR_AFFIX_COUNT[rarity].max && availableAffixesForItem(item).length > 0;
    case "voidstone":
      return item.affixes.length > 0;
    case "ascension-seal": {
      const nextDefId = item.definitionId.replace("-basic", "-astral");
      return rarity === "basic" && nextDefId !== item.definitionId && gearDefinitions[nextDefId] !== undefined;
    }
    case "severance-maw":
      return item.affixes.length >= 1;
    case "smiths-whetstone":
      return item.affixes.length >= 1 && hasUpgradeableAffix(item);
    default:
      return false;
  }
}

export function applyCraftingCurrency(
  currencyId: CraftingCurrencyId,
  item: GearInstance,
  rng: () => number,
): GearInstance {
  if (!canApplyCraftingCurrency(currencyId, item)) return item;

  switch (currencyId) {
    case "discordant-dice":
      return { ...item, affixes: rollDistinctAffixes(item, item.affixes.length, rng) };

    case "sprig-of-growth":
      return addRandomAffix(item, rng);

    case "voidstone":
      return { ...item, affixes: [] };

    case "ascension-seal": {
      const nextDefId = item.definitionId.replace("-basic", "-astral");
      if (!gearDefinitions[nextDefId]) return item;
      return { ...item, definitionId: nextDefId, affixes: item.affixes.map(upgradeAffixValueToAstral) };
    }

    case "severance-maw": {
      const index = Math.floor(rng() * item.affixes.length);
      const affixes = item.affixes.filter((_, affixIndex) => affixIndex !== index);
      return { ...item, affixes };
    }

    case "smiths-whetstone": {
      const rarity = gearInstanceRarity(item);
      const upgradeableIndexes = item.affixes.flatMap((affix, index) =>
        affix.value < affixMaxValue(affix, rarity) ? [index] : [],
      );
      const index = pickRandom(upgradeableIndexes, rng);
      if (index === undefined) return item;
      const affixes = item.affixes.map((affix, affixIndex) =>
        affixIndex === index ? { ...affix, value: affix.value + 1 } : affix,
      );
      return { ...item, affixes };
    }

    default:
      return item;
  }
}

export function rollSalvageYield(rarity: GearRarity, rng: () => number): Record<CraftingCurrencyId, number> {
  const yieldRecord = { ...EMPTY_CRAFTING_CURRENCIES };

  if (rarity === "basic") {
    yieldRecord["discordant-dice"] = rng() < 0.5 ? 1 : 2;
    if (rng() < 0.5) yieldRecord["sprig-of-growth"] = 1;
    if (rng() < 0.25) yieldRecord.voidstone = 1;
  } else {
    yieldRecord["discordant-dice"] = rng() < 0.5 ? 1 : 2;
    if (rng() < 0.35) yieldRecord["ascension-seal"] = 1;
    if (rng() < 0.35) yieldRecord["severance-maw"] = 1;
    if (rng() < 0.35) yieldRecord["smiths-whetstone"] = 1;
  }

  return yieldRecord;
}
