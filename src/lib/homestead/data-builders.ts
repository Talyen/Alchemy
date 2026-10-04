import type { HomesteadEffectManifest, HomesteadUpgradeItem, MaterialInventory } from "./types";
import type { MaterialId } from "./types";
import { emptyInventory } from "./inventory";

const HOMESTEAD_SINGLE_TIER_COSTS = [20, 30, 40] as const;

export function materialCost(partial: Partial<MaterialInventory>): MaterialInventory {
  return { ...emptyInventory(), ...partial };
}

function singleResourceLadder(material: MaterialId, amounts: readonly number[]): MaterialInventory[] {
  return amounts.map((amount) => materialCost({ [material]: amount }));
}

export function singleMaterialCosts(material: MaterialId): MaterialInventory[] {
  return singleResourceLadder(material, HOMESTEAD_SINGLE_TIER_COSTS);
}

export type PerTierEffects =
  | Partial<HomesteadEffectManifest>
  | ((tierOneBased: number) => Partial<HomesteadEffectManifest>);

// Shared four-tier cost ladders. Each returns fresh inventories so upgrades
// never share mutable cost objects; values match the previously inlined
// materialCost rows exactly.
export function woodHideCosts(): MaterialInventory[] {
  return [
    materialCost({ wood: 8, hide: 10 }),
    materialCost({ wood: 12, hide: 15 }),
    materialCost({ wood: 16, hide: 20 }),
    materialCost({ wood: 20, hide: 25 }),
  ];
}

export function woodFoodCosts(): MaterialInventory[] {
  return [
    materialCost({ wood: 8, food: 12 }),
    materialCost({ wood: 12, food: 17 }),
    materialCost({ wood: 16, food: 23 }),
    materialCost({ wood: 20, food: 29 }),
  ];
}

export function woodStoneCosts(): MaterialInventory[] {
  return [
    materialCost({ wood: 8, stone: 8 }),
    materialCost({ wood: 12, stone: 12 }),
    materialCost({ wood: 16, stone: 16 }),
    materialCost({ wood: 20, stone: 20 }),
  ];
}

export function herbsSingleCosts(): MaterialInventory[] {
  return singleResourceLadder("herbs", [22, 33, 44, 55]);
}

export function foodSingleCosts(): MaterialInventory[] {
  return singleResourceLadder("food", [23, 35, 46, 58]);
}

export function gemsSingleCosts(): MaterialInventory[] {
  return singleResourceLadder("gems", [21, 32, 42, 53]);
}

type BenefitFn = (tierOneBased: number) => string;

export function stackingUpgrade<TId extends string>(
  id: TId,
  title: string,
  costs: readonly MaterialInventory[],
  perTierEffects: PerTierEffects,
  benefitForTier: BenefitFn,
  nonCombatBenefitDescription?: string | BenefitFn,
): HomesteadUpgradeItem<TId> {
  return {
    id,
    title,
    tiers: costs.map((cost, index) => {
      const tierOneBased = index + 1;
      const effects = typeof perTierEffects === "function" ? perTierEffects(tierOneBased) : { ...perTierEffects };
      return {
        cost,
        effects,
        benefitDescription: benefitForTier(tierOneBased),
        ...(nonCombatBenefitDescription
          ? {
              nonCombatBenefitDescription:
                typeof nonCombatBenefitDescription === "function"
                  ? nonCombatBenefitDescription(tierOneBased)
                  : nonCombatBenefitDescription,
            }
          : {}),
      };
    }),
  };
}
