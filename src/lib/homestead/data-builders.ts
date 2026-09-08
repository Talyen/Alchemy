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
import { dualMaterialCosts, materialCost, singleMaterialCosts } from "./costs";

export function stackingTiers(
  costs: readonly MaterialInventory[],
  perTierEffects: Partial<HomesteadEffectManifest>,
  benefitForTier: (tierOneBased: number) => string,
  nonCombatBenefitDescription?: string,
): HomesteadUpgradeTier[] {
  return costs.map((cost, index) => ({
    cost,
    effects: { ...perTierEffects },
    benefitDescription: benefitForTier(index + 1),
    ...(nonCombatBenefitDescription ? { nonCombatBenefitDescription } : {}),
  }));
}

function defineUpgradeItem<TId extends string>(
  id: TId,
  title: string,
  tiers: HomesteadUpgradeTier[],
): HomesteadUpgradeItem<TId> {
  return { id, title, tiers };
}

export function defineBuilding(id: BuildingId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadBuilding {
  return defineUpgradeItem(id, title, tiers);
}

export function defineFarm(id: FarmId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadFarm {
  return defineUpgradeItem(id, title, tiers);
}

export function defineResearch(id: ResearchId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadResearch {
  return defineUpgradeItem(id, title, tiers);
}

export { dualMaterialCosts, materialCost, singleMaterialCosts };
