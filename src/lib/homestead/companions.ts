import { companionLibrary, type CompanionId } from "@/lib/game-data";
import { scaledMaterialCosts } from "./data-builders";
import type { TieredItem } from "./tiers";

export const COMPANION_BOND_TIERS = scaledMaterialCosts({ food: 10 }, 3);

export const COMPANION_MAX_TIER = COMPANION_BOND_TIERS.length;

export const companionTierItems: ReadonlyArray<TieredItem<CompanionId>> = Object.keys(companionLibrary).map((id) => ({
  id: id as CompanionId,
  tiers: COMPANION_BOND_TIERS.map((cost) => ({ cost })),
}));
