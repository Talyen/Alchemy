import type { KeywordId } from "@/lib/game-data";
import { emptyInventory } from "@/lib/homestead/inventory";
import type { MaterialInventory } from "@/lib/homestead/types";
import type { GearRarity, GearSlot } from "../types-core";

export interface GearBaseItemDefinition {
  id: string;
  displayName: string;
  compatibleSlots: GearSlot[];
  requiresTwoHands: boolean;
  affinityKeywords: KeywordId[];
  availableRarities: readonly GearRarity[];
  salvageByRarity: Record<GearRarity, MaterialInventory>;
  rangedWeapon?: boolean;
  quiver?: boolean;
}

function salvage(basicIron: number, astralIron: number, astralCrystal = 1): Record<GearRarity, MaterialInventory> {
  return {
    basic: { ...emptyInventory(), iron: basicIron },
    astral: { ...emptyInventory(), iron: astralIron, crystal: astralCrystal },
  };
}

export const lightSalvage = salvage(1, 2);
export const mediumSalvage = salvage(2, 3);
export const heavySalvage = salvage(3, 4);
