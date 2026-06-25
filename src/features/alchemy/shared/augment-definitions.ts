// Augment definitions for enemy status effects that modify base keyword mechanics.
// These are not keywords — they are status effects that happen to borrow visuals
// (icon, color) from the keyword system for thematic consistency.
// Depends on keyword icons/colors, not keyword types.
import type { LucideIcon } from "lucide-react";
import { keywordIcons } from "./config";
import { keywordDefinitions } from "@/lib/game-data";

export interface AugmentDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
}

type AugmentId = "burnBonus" | "freezeBonus";

export const augmentDefinitions: Record<AugmentId, AugmentDefinition> = {
  burnBonus: {
    id: "burnBonus",
    label: "Burn Bonus",
    description: "Bonus Burn damage added to attacks. Persists for the duration of combat.",
    icon: keywordIcons.burn,
    colorClass: keywordDefinitions.burn.colorClass,
  },
  freezeBonus: {
    id: "freezeBonus",
    label: "Freeze Bonus",
    description: "Bonus Freeze damage added to attacks. Persists for the duration of combat.",
    icon: keywordIcons.freeze,
    colorClass: keywordDefinitions.freeze.colorClass,
  },
};

export type { AugmentId };
