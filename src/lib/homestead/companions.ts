// Shared companion bond tier data for Homestead state, saves, and validation.
// Depends on companion game data and tier-record helpers so companion defaults stay in sync.
import { companionLibrary, type CompanionId } from "@/lib/game-data";
import { singleMaterialCosts } from "./costs";
import type { TieredItem } from "./tiers";

export const COMPANION_BOND_TIERS = singleMaterialCosts("food");

export const COMPANION_MAX_TIER = COMPANION_BOND_TIERS.length;

export const companionTierItems: ReadonlyArray<TieredItem<CompanionId>> = Object.keys(companionLibrary).map((id) => ({
  id: id as CompanionId,
  tiers: COMPANION_BOND_TIERS,
}));
