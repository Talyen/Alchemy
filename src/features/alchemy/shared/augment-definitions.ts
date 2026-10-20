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

export const ARMED_PLAYER_CHIP_IDS = [
  "hawkEyeReady",
  "playNextCardTwice",
  "nextHitCrit",
  "nextPhysicalCrit",
  "nextHitLeech",
  "nextHitPoison",
  "nextHitPhysicalBonus",
  "nextPhysicalDealsBleed",
  "nextArcheryCardFree",
  "nextHolyCardFree",
  "nextNatureCardFree",
  "dodgeNextAttack",
] as const;
export type ArmedFlagChipId = (typeof ARMED_PLAYER_CHIP_IDS)[number];
export type PendingPulseChipId = `pending-${DamageType}`;

const pendingPulseDefinitions = Object.fromEntries(
  DAMAGE_TYPES.map((damageType) => [
    `pending-${damageType}`,
    {
      id: `pending-${damageType}`,
      label: `Incoming ${keywordDefinitions[damageType].label}`,
      description: `${keywordDefinitions[damageType].label} damage hits this enemy at the start of your next turn.`,
      icon: keywordIcons[damageType],
      colorClass: keywordDefinitions[damageType].colorClass,
    } satisfies AugmentDefinition,
  ]),
) as Record<PendingPulseChipId, AugmentDefinition>;

const fixedDefinitions = {
  hawkEyeReady: {
    label: "Hawk Eye",
    description: "Hawk Eye makes your next attack a Critical Hit.",
    icon: keywordIcons.archery,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  burnBonus: {
    label: "Burn Bonus",
    description: "Burn damage from this enemy's attacks is increased.",
    icon: keywordIcons.burn,
    colorClass: keywordDefinitions.burn.colorClass,
  },
  freezeBonus: {
    label: "Freeze Bonus",
    description: "Freeze damage from this enemy's attacks is increased.",
    icon: keywordIcons.freeze,
    colorClass: keywordDefinitions.freeze.colorClass,
  },
  onAttackBleed: {
    label: "Retaliate",
    description: "This enemy takes Bleed damage after its next attack.",
    icon: keywordIcons.bleed,
    colorClass: keywordDefinitions.bleed.colorClass,
  },
  echo: {
    label: "Echo",
    description: "Echo repeats an effect at the start of your next turn.",
    icon: Repeat,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  ccImmunity: {
    label: "Control Immunity",
    description: "Control Immunity prevents Stun and Freeze buildup.",
    icon: ShieldCheck,
    colorClass: "text-zinc-400",
  },
  stunned: {
    label: "Stunned",
    description: "Stunned combatants skip their next turn.",
    icon: keywordIcons.stun,
    colorClass: keywordDefinitions.stun.colorClass,
  },
  frozen: {
    label: "Frozen",
    description: "Frozen combatants skip their next turn.",
    icon: keywordIcons.freeze,
    colorClass: keywordDefinitions.freeze.colorClass,
  },
  playNextCardTwice: {
    label: "Shadowstep",
    description: "Shadowstep plays your next card twice.",
    icon: Copy,
    colorClass: "text-violet-300",
  },
  nextHitCrit: {
    label: "Predator's Focus",
    description: "Predator's Focus makes your next card hit a Critical Hit.",
    icon: Focus,
    colorClass: "text-amber-200",
  },
  nextPhysicalCrit: {
    label: "Riposte",
    description: "Riposte makes your next Physical attack a Critical Hit.",
    icon: Focus,
    colorClass: keywordDefinitions.physical.colorClass,
  },
  nextHitLeech: {
    label: "Predator's Hunger",
    description: "Your next card hit gains Leech.",
    icon: keywordIcons.leech,
    colorClass: keywordDefinitions.leech.colorClass,
  },
  nextHitPoison: {
    label: "Poison Dagger",
    description: "Your next attack deals Poison damage instead.",
    icon: keywordIcons.poison,
    colorClass: keywordDefinitions.poison.colorClass,
  },
  nextHitPhysicalBonus: {
    label: "Opening",
    description: "Your next attack deals extra Physical damage.",
    icon: keywordIcons.physical,
    colorClass: keywordDefinitions.physical.colorClass,
  },
  nextPhysicalDealsBleed: {
    label: "Parting Cut",
    description: "Your next Physical hit deals half its damage as extra Bleed damage.",
    icon: keywordIcons.bleed,
    colorClass: keywordDefinitions.bleed.colorClass,
  },
  nextArcheryCardFree: {
    label: "Arrow Dance",
    description: "Your next Archery card costs no Mana.",
    icon: keywordIcons.archery,
    colorClass: keywordDefinitions.archery.colorClass,
  },
  nextHolyCardFree: {
    label: "Divine Favor",
    description: "Your next Holy card costs no Mana.",
    icon: keywordIcons.holy,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  nextNatureCardFree: {
    label: "Windstep",
    description: "Your next Nature card costs no Mana.",
    icon: keywordIcons.nature,
    colorClass: keywordDefinitions.nature.colorClass,
  },
  dodgeNextAttack: {
    label: "Evasion",
    description: "Dodge the next incoming attack hit.",
    icon: keywordIcons.dodge,
    colorClass: keywordDefinitions.dodge.colorClass,
  },
} satisfies Record<ArmedFlagChipId, Omit<AugmentDefinition, "id">> & Record<string, Omit<AugmentDefinition, "id">>;

export type AugmentId = keyof typeof fixedDefinitions | PendingPulseChipId;

export const augmentDefinitions: Record<AugmentId, AugmentDefinition> = {
  ...(Object.fromEntries(
    Object.entries(fixedDefinitions).map(([id, definition]) => [id, { ...definition, id }]),
  ) as Record<keyof typeof fixedDefinitions, AugmentDefinition>),
  ...pendingPulseDefinitions,
};
