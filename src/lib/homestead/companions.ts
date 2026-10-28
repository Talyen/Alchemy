import { cardLibrary, companionLibrary, type CompanionId } from "@/lib/game-data";
import { scaledMaterialCosts } from "./data-builders";
import { canAfford } from "./inventory";
import type { MaterialInventory } from "./types";
import type { TieredItem } from "./tiers";

export const COMPANION_BOND_TIERS = Object.freeze(
  scaledMaterialCosts({ food: 10 }, 3).map((cost) => Object.freeze(cost)),
);

export const COMPANION_MAX_TIER = COMPANION_BOND_TIERS.length;

const companionTiers = Object.freeze(COMPANION_BOND_TIERS.map((cost) => Object.freeze({ cost })));

export const companionTierItems: ReadonlyArray<TieredItem<CompanionId>> = Object.freeze(
  Object.keys(companionLibrary).map((id) =>
    Object.freeze({
      id: id as CompanionId,
      tiers: companionTiers,
    }),
  ),
);

const companionSummonCardIdByCompanion = new Map<CompanionId, string>();
for (const card of cardLibrary) {
  for (const effect of card.effects) {
    if (effect.kind === "summon-companion") {
      companionSummonCardIdByCompanion.set(effect.companionId, card.id);
    }
  }
}

export function companionSummonCardId(companionId: CompanionId): string | undefined {
  return companionSummonCardIdByCompanion.get(companionId);
}

export function canBondCompanion(
  companionId: CompanionId,
  discoveredCardIds: readonly string[],
  bondedCompanions: Record<string, number>,
  inventory: MaterialInventory,
): boolean {
  const cardId = companionSummonCardId(companionId);
  if (!cardId || !discoveredCardIds.includes(cardId)) return false;
  const currentLevel = bondedCompanions[companionId] ?? 0;
  if (currentLevel >= COMPANION_MAX_TIER) return false;
  const bondTier = COMPANION_BOND_TIERS[currentLevel];
  return bondTier !== undefined && canAfford(inventory, bondTier);
}
