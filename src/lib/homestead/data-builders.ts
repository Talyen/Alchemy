import type { HomesteadEffectManifest, HomesteadUpgradeItem, MaterialInventory } from "./types";
import { emptyInventory } from "./inventory";

// Costs grow linearly from the authored first tier. Each tier owns its inventory.
export function scaledMaterialCosts(firstTier: Partial<MaterialInventory>, tierCount = 4): MaterialInventory[] {
  return Array.from({ length: tierCount }, (_, index) => {
    const cost = emptyInventory();
    for (const material of Object.keys(firstTier) as Array<keyof MaterialInventory>) {
      cost[material] = firstTier[material]! * (index + 1);
    }
    return cost;
  });
}

export type PerTierEffects =
  | Partial<HomesteadEffectManifest>
  | ((tierOneBased: number) => Partial<HomesteadEffectManifest>);

type BenefitFn = (tierOneBased: number) => string;

export function stackingUpgrade<TId extends string>(
  id: TId,
  title: string,
  costs: readonly MaterialInventory[],
  perTierEffects: PerTierEffects,
  benefitForTier: BenefitFn,
  nonCombatBenefitDescription?: BenefitFn,
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
              nonCombatBenefitDescription: nonCombatBenefitDescription(tierOneBased),
            }
          : {}),
      };
    }),
  };
}
