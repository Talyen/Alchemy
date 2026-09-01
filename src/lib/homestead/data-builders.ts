import type {
  BuildingId,
  FarmId,
  HomesteadBuilding,
  HomesteadEffectManifest,
  HomesteadFarm,
  HomesteadResearch,
  ResearchId,
} from "./types";
import { dualMaterialCosts, materialCost, singleMaterialCosts } from "./costs";
import type { MaterialInventory } from "./types";

type HomesteadUpgradeTier = HomesteadBuilding["tiers"][number];

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

export function defineBuilding(id: BuildingId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadBuilding {
  return { id, title, description: "", buttonLabel: "Build", tiers };
}

export function defineFarm(id: FarmId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadFarm {
  return {
    id,
    title,
    description: "",
    buttonLabel: "Build",
    tiers,
  };
}

export function defineResearch(id: ResearchId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadResearch {
  return { id, title, description: "", buttonLabel: "Research", tiers };
}

export { dualMaterialCosts, materialCost, singleMaterialCosts };
