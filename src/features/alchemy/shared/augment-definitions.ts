// Augment definitions for status effects that are not keywords but borrow visuals
// (icon, color) from the keyword system for thematic consistency. Covers enemy augments
// (burnBonus/freezeBonus), armed player buffs (Shadowstep/Predator's Focus/Poison Dagger),
// delayed repeat-over-turns pulses, and Hemorrhage's on-attack bleed.
import type { LucideIcon } from "lucide-react";
import { Copy, Focus, Repeat, ShieldCheck } from "lucide-react";
import { keywordIcons } from "./config";
import { DAMAGE_TYPES, keywordDefinitions, type DamageType } from "@/lib/game-data";

export interface AugmentDefinition {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
}

/** Armed one-shot player buffs keyed by their CombatFlags field. */
export type ArmedFlagChipId = "playNextCardTwice" | "nextHitCrit" | "nextHitPoison";

/** Enemy-side chips for purely-offensive repeat-over-turns pulses, grouped by damage type. */
export type PendingPulseChipId = `pending-${DamageType}`;

export type AugmentId =
  | "burnBonus"
  | "freezeBonus"
  | "onAttackBleed"
  | "echo"
  | "ccImmunity"
  | ArmedFlagChipId
  | PendingPulseChipId;

const pendingPulseDefinitions = Object.fromEntries(
  DAMAGE_TYPES.map((damageType) => [
    `pending-${damageType}`,
    {
      id: `pending-${damageType}`,
      label: `Incoming ${keywordDefinitions[damageType].label}`,
      description: `Deals ${keywordDefinitions[damageType].label} damage to the enemy at the start of your next turn.`,
      icon: keywordIcons[damageType],
      colorClass: keywordDefinitions[damageType].colorClass,
    } satisfies AugmentDefinition,
  ]),
);

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
  onAttackBleed: {
    id: "onAttackBleed",
    label: "Retaliate",
    description: "The enemy takes Bleed damage the next time it attacks.",
    icon: keywordIcons.bleed,
    colorClass: keywordDefinitions.bleed.colorClass,
  },
  echo: {
    id: "echo",
    label: "Echo",
    description: "A played effect repeats at the start of your next turn.",
    icon: Repeat,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  ccImmunity: {
    id: "ccImmunity",
    label: "Control Immunity",
    description: "Stun and Freeze build-up has no effect while immune.",
    icon: ShieldCheck,
    colorClass: "text-zinc-400",
  },
  playNextCardTwice: {
    id: "playNextCardTwice",
    label: "Shadowstep",
    description: "Your next card is played twice.",
    icon: Copy,
    colorClass: "text-violet-300",
  },
  nextHitCrit: {
    id: "nextHitCrit",
    label: "Predator's Focus",
    description: "Your next damaging card is a critical strike.",
    icon: Focus,
    colorClass: "text-amber-200",
  },
  nextHitPoison: {
    id: "nextHitPoison",
    label: "Poison Dagger",
    description: "Your next attack is converted to Poison damage.",
    icon: keywordIcons.poison,
    colorClass: keywordDefinitions.poison.colorClass,
  },
  ...pendingPulseDefinitions,
} as Record<AugmentId, AugmentDefinition>;
