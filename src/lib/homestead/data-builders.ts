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

export function defineBuilding(id: BuildingId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadBuilding {
  return defineUpgradeItem(id, title, tiers);
}

export function defineFarm(id: FarmId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadFarm {
  return defineUpgradeItem(id, title, tiers);
}

export function defineResearch(id: ResearchId, title: string, tiers: HomesteadUpgradeTier[]): HomesteadResearch {
  return defineUpgradeItem(id, title, tiers);
}
