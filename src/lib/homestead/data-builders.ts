// Factories for homestead building, farm, and research data — reduces repeated tier/cost boilerplate.
import type {
  BuildingId,
  FarmId,
  HomesteadBuilding,
  HomesteadEffectManifest,
  HomesteadFarm,
  HomesteadResearch,
  MaterialInventory,
  ResearchId,
} from "./types";
import { dualMaterialCosts, materialCost, singleMaterialCosts } from "./costs";
import { emptyInventory } from "./inventory";

type HomesteadUpgradeTier = HomesteadBuilding["tiers"][number];

const ZERO_YIELD: MaterialInventory = emptyInventory();

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

export function defineFarm(id: FarmId, title: string, tiers: HomesteadUpgradeTier[], hidden?: boolean): HomesteadFarm {
  return {
    id,
    title,
    description: "",
    yield: { ...ZERO_YIELD },
    buttonLabel: "Build",
    tiers,
    ...(hidden ? { hidden: true } : {}),
  };
}

export function defineResearch(id: ResearchId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadResearch {
  return { id, title, description: "", buttonLabel: "Research", tiers };
}

export { dualMaterialCosts, materialCost, singleMaterialCosts };
