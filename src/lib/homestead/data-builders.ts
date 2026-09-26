import type {
  BuildingId,
  FarmId,
  HomesteadBuilding,
  HomesteadEffectManifest,
  HomesteadFarm,
  HomesteadResearch,
  HomesteadUpgradeItem,
  HomesteadUpgradeTier,
  MaterialInventory,
  ResearchId,
} from "./types";
import type { MaterialId } from "./types";
import { emptyInventory } from "./inventory";

const HOMESTEAD_SINGLE_TIER_COSTS = [20, 30, 40] as const;

export function materialCost(partial: Partial<MaterialInventory>): MaterialInventory {
  return { ...emptyInventory(), ...partial };
}

export function singleMaterialCosts(material: MaterialId): MaterialInventory[] {
  return HOMESTEAD_SINGLE_TIER_COSTS.map((amount) => materialCost({ [material]: amount }));
}

export function stackingTiers(
  costs: readonly MaterialInventory[],
  perTierEffects: Partial<HomesteadEffectManifest>,
  benefitForTier: (tierOneBased: number) => string,
  nonCombatBenefitDescription?: string | ((tierOneBased: number) => string),
): HomesteadUpgradeTier[] {
  return costs.map((cost, index) => ({
    cost,
    effects: { ...perTierEffects },
    benefitDescription: benefitForTier(index + 1),
    ...(nonCombatBenefitDescription
      ? {
          nonCombatBenefitDescription:
            typeof nonCombatBenefitDescription === "function"
              ? nonCombatBenefitDescription(index + 1)
              : nonCombatBenefitDescription,
        }
      : {}),
  }));
}

function defineUpgradeItem<TId extends string>(
  id: TId,
  title: string,
  tiers: HomesteadUpgradeTier[],
): HomesteadUpgradeItem<TId> {
  return { id, title, tiers };
}

export function defineResearch(id: ResearchId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadResearch {
  return defineUpgradeItem(id, title, tiers);
}

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
  return [
    materialCost({ herbs: 22 }),
    materialCost({ herbs: 33 }),
    materialCost({ herbs: 44 }),
    materialCost({ herbs: 55 }),
  ];
}

export function foodSingleCosts(): MaterialInventory[] {
  return [
    materialCost({ food: 23 }),
    materialCost({ food: 35 }),
    materialCost({ food: 46 }),
    materialCost({ food: 58 }),
  ];
}

export function gemsSingleCosts(): MaterialInventory[] {
  return [
    materialCost({ gems: 21 }),
    materialCost({ gems: 32 }),
    materialCost({ gems: 42 }),
    materialCost({ gems: 53 }),
  ];
}

type BenefitFn = (tierOneBased: number) => string;

export function stackingBuilding(
  id: BuildingId,
  title: string,
  costs: readonly MaterialInventory[],
  perTierEffects: Partial<HomesteadEffectManifest>,
  benefitForTier: BenefitFn,
  nonCombatBenefitDescription?: string | BenefitFn,
): HomesteadBuilding {
  return defineUpgradeItem(
    id,
    title,
    stackingTiers(costs, perTierEffects, benefitForTier, nonCombatBenefitDescription),
  );
}

export function stackingFarm(
  id: FarmId,
  title: string,
  costs: readonly MaterialInventory[],
  perTierEffects: Partial<HomesteadEffectManifest>,
  benefitForTier: BenefitFn,
  nonCombatBenefitDescription?: string | BenefitFn,
): HomesteadFarm {
  return defineUpgradeItem(
    id,
    title,
    stackingTiers(costs, perTierEffects, benefitForTier, nonCombatBenefitDescription),
  );
}

export function stackingResearch(
  id: ResearchId,
  title: string,
  costs: readonly MaterialInventory[],
  perTierEffects: Partial<HomesteadEffectManifest>,
  benefitForTier: BenefitFn,
  nonCombatBenefitDescription?: string | BenefitFn,
): HomesteadResearch {
  return defineResearch(id, title, stackingTiers(costs, perTierEffects, benefitForTier, nonCombatBenefitDescription));
}
