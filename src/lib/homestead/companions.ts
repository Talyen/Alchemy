// Shared companion bond tier data for Homestead state, saves, and validation.
// Depends on companion game data and tier-record helpers so companion defaults stay in sync.
import { companionLibrary, type CompanionId } from "@/lib/game-data";
import type { MaterialInventory } from "./types";
import type { TieredItem } from "./tiers";

export const COMPANION_BOND_TIERS = [
  { wood: 0, iron: 0, herbs: 0, food: 20, crystal: 0 },
  { wood: 0, iron: 0, herbs: 0, food: 30, crystal: 0 },
  { wood: 0, iron: 0, herbs: 0, food: 40, crystal: 0 },
] as const satisfies readonly MaterialInventory[];

export const COMPANION_MAX_TIER = COMPANION_BOND_TIERS.length;

export const companionTierItems: readonly TieredItem<CompanionId>[] = Object.keys(companionLibrary).map((id) => ({
  id: id as CompanionId,
  tiers: COMPANION_BOND_TIERS,
}));
