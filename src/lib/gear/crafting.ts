import {
  GEAR_AFFIX_COUNT,
  SALVAGE_ADVANCED_MAW_CHANCE_FRACTION,
  SALVAGE_ADVANCED_SEAL_CHANCE_FRACTION,
  SALVAGE_ADVANCED_WHETSTONE_CHANCE_FRACTION,
  SALVAGE_BASIC_SPRIG_CHANCE_FRACTION,
  SALVAGE_BASIC_VOIDSTONE_CHANCE_FRACTION,
  SALVAGE_DICE_HIGH_CHANCE_FRACTION,
} from "@/lib/game-constants";
import { createSeededRng, hashStringToUint32, pickRandom, rngInt } from "@/lib/rng";
import { craftingArt } from "@/lib/game-data";
import { buildEligibleAffixPool, rollAffixes } from "./affix-pool";
import { rollAffixValue } from "./affixes";
import { gearAffixCatalog } from "./affix-catalog";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import { gearDefinitionId, gearDefinitions, gearInstanceRarity } from "./definitions";
import { type GearInstance, type GearAffixRoll, type GearRarity } from "./types";
import { clamp, clamp01, lerp } from "@/lib/math";
import { EMPTY_CRAFTING_CURRENCIES, type CraftingCurrencyId } from "./crafting-ids";
export type { CraftingCurrencyId } from "./crafting-ids";

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
    tooltipEffect: "**Reroll** All Affixes",
    description: "Rerolls all affixes using normal affinity rules.",
    art: craftingArt["discordant-dice"]!,
  },
  {
    id: "sprig-of-growth",
    displayName: "Sprig of Growth",
    tooltipEffect: "**Add** a Random Affix",
    description: "Adds a random affix using normal affinity rules.",
    art: craftingArt["sprig-of-growth"]!,
  },
  {
    id: "voidstone",
    displayName: "Voidstone",
    tooltipEffect: "**Remove** All Affixes",
    description: "Removes all affixes from an item.",
    art: craftingArt.voidstone!,
  },
  {
    id: "ascension-seal",
    displayName: "Ascension Seal",
    tooltipEffect: "**Upgrade** a Basic item to Astral quality",
    description: "Upgrades a Basic item and its existing affixes to Astral quality.",
    art: craftingArt["ascension-seal"]!,
  },
  {
    id: "severance-maw",
    displayName: "Severance Maw",
    tooltipEffect: "**Remove** a Random Affix",
    description: "Removes a random affix from an item.",
    art: craftingArt["severance-maw"]!,
  },
  {
    id: "smiths-whetstone",
    displayName: "Smith's Whetstone",
    tooltipEffect: "**Upgrade** a Random Affix",
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

function affixMaxValue(roll: GearAffixRoll, rarity: GearRarity): number {
  const def = gearAffixCatalog[roll.id];
  return def ? def.roll[rarity].max : roll.value;
}

function upgradeAffixValueToAstral(roll: GearAffixRoll): GearAffixRoll {
  const def = gearAffixCatalog[roll.id];
  if (!def) return roll;
  const basic = def.roll.basic;
  const astral = def.roll.astral;
  const basicSpan = Math.max(1, basic.max - basic.min);
  const progress = clamp01((roll.value - basic.min) / basicSpan);
  return {
    ...roll,
    value: clamp(Math.round(lerp(astral.min, astral.max, progress)), astral.min, astral.max),
  };
}

// Preparation resolves legality and eligible choices without drawing randomness.
// Preview reads the rejection; application executes the same rule against the
// current item, so guards and transformations cannot drift into separate tables.
type CraftingPlan = string | ((rng: () => number) => GearInstance);

function prepareCraftingCurrency(currencyId: CraftingCurrencyId, item: GearInstance): CraftingPlan {
  const rarity = gearInstanceRarity(item);
  if (rarity === "unique") return "Unique items cannot be crafted.";
  const definition = gearDefinitions[item.definitionId];
  switch (currencyId) {
    case "discordant-dice":
      if (!item.affixes.length) return "This item has no affixes to reroll.";
      return (rng) => ({ ...item, affixes: definition ? rollAffixes(definition, item.affixes.length, rng) : [] });
    case "sprig-of-growth": {
      const presentIds = new Set(item.affixes.map((affix) => affix.id));
      const available = definition
        ? buildEligibleAffixPool(definition).filter((affix) => !presentIds.has(affix.id))
        : [];
      if (!rarity || item.affixes.length >= GEAR_AFFIX_COUNT[rarity].max || !available.length)
        return "No affix slots or eligible affixes available.";
      return (rng) => {
        const chosen = pickRandom(available, rng)!;
        return { ...item, affixes: [...item.affixes, { id: chosen.id, value: rollAffixValue(chosen, rarity, rng) }] };
      };
    }
    case "voidstone":
      if (!item.affixes.length) return "This item has no affixes to remove.";
      return () => ({ ...item, affixes: [] });
    case "ascension-seal": {
      const nextDefinitionId = definition && gearDefinitionId(definition.baseItemId, "astral");
      if (rarity !== "basic" || !nextDefinitionId || !gearDefinitions[nextDefinitionId])
        return "Only Basic items can be upgraded to Astral.";
      return () => ({ ...item, definitionId: nextDefinitionId, affixes: item.affixes.map(upgradeAffixValueToAstral) });
    }
    case "severance-maw":
      if (!item.affixes.length) return "This item has no affixes to remove.";
      return (rng) => {
        const index = rngInt(rng, item.affixes.length);
        return { ...item, affixes: item.affixes.filter((_, affixIndex) => affixIndex !== index) };
      };
    case "smiths-whetstone": {
      if (!item.affixes.length) return "This item has no affixes to upgrade.";
      const indexes = item.affixes.flatMap((affix, index) =>
        affix.value < affixMaxValue(affix, rarity ?? "basic") ? [index] : [],
      );
      if (!indexes.length) return "All affixes are already at maximum.";
      return (rng) => {
        const index = pickRandom(indexes, rng)!;
        return {
          ...item,
          affixes: item.affixes.map((affix, affixIndex) =>
            affixIndex === index ? { ...affix, value: affix.value + 1 } : affix,
          ),
        };
      };
    }
  }
}

export function craftingCurrencyBlockedReason(currencyId: CraftingCurrencyId, item: GearInstance): string | null {
  const plan = prepareCraftingCurrency(currencyId, item);
  return typeof plan === "string" ? plan : null;
}

export function canApplyCraftingCurrency(currencyId: CraftingCurrencyId, item: GearInstance): boolean {
  return craftingCurrencyBlockedReason(currencyId, item) === null;
}

export function applyCraftingCurrency(
  currencyId: CraftingCurrencyId,
  item: GearInstance,
  rng: () => number,
): GearInstance {
  const plan = prepareCraftingCurrency(currencyId, item);
  return typeof plan === "string" ? item : plan(rng);
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

  yieldRecord["discordant-dice"] = rng() < SALVAGE_DICE_HIGH_CHANCE_FRACTION ? 2 : 1;
  if (rarity === "basic") {
    if (rng() < SALVAGE_BASIC_SPRIG_CHANCE_FRACTION) yieldRecord["sprig-of-growth"] = 1;
    if (rng() < SALVAGE_BASIC_VOIDSTONE_CHANCE_FRACTION) yieldRecord.voidstone = 1;
  } else {
    if (rng() < SALVAGE_ADVANCED_SEAL_CHANCE_FRACTION) yieldRecord["ascension-seal"] = 1;
    if (rng() < SALVAGE_ADVANCED_MAW_CHANCE_FRACTION) yieldRecord["severance-maw"] = 1;
    if (rng() < SALVAGE_ADVANCED_WHETSTONE_CHANCE_FRACTION) yieldRecord["smiths-whetstone"] = 1;
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

export function computeSalvageYield(instance: GearInstance): SalvageYield {
  const rng = createSeededRng(hashStringToUint32(`salvage:${instance.instanceId}`));
  return {
    currencies: rollSalvageYield(gearInstanceRarity(instance) ?? "basic", rng),
    materials: homesteadSalvageYield(instance),
  };
}
