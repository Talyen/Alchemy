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
  "nextHitLeech",
  "nextHitPoison",
  "nextHitPhysicalBonus",
  "nextPhysicalDealsBleed",
  "nextArcheryCardFree",
  "nextWishExtraChoice",
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
      description: `Deals ${keywordDefinitions[damageType].label} damage to the enemy at the start of your next turn.`,
      icon: keywordIcons[damageType],
      colorClass: keywordDefinitions[damageType].colorClass,
    } satisfies AugmentDefinition,
  ]),
) as Record<PendingPulseChipId, AugmentDefinition>;

const fixedDefinitions = {
  hawkEyeReady: {
    label: "Hawk Eye",
    description: "Your next attack Critically Hits. Does not stack. Lasts until used or combat ends.",
    icon: keywordIcons.archery,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  nextWishExtraChoice: {
    label: "Divine Intervention",
    description: "Your next Wish offers 1 additional card choice. Does not stack. Lasts until used or combat ends.",
    icon: keywordIcons.wish,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  burnBonus: {
    label: "Burn Bonus",
    description: "Bonus Burn damage added to attacks. Persists for the duration of combat.",
    icon: keywordIcons.burn,
    colorClass: keywordDefinitions.burn.colorClass,
  },
  freezeBonus: {
    label: "Freeze Bonus",
    description: "Bonus Freeze damage added to attacks. Persists for the duration of combat.",
    icon: keywordIcons.freeze,
    colorClass: keywordDefinitions.freeze.colorClass,
  },
  onAttackBleed: {
    label: "Retaliate",
    description: "The enemy takes Bleed damage the next time it attacks.",
    icon: keywordIcons.bleed,
    colorClass: keywordDefinitions.bleed.colorClass,
  },
  echo: {
    label: "Echo",
    description: "A played effect repeats at the start of your next turn.",
    icon: Repeat,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  ccImmunity: {
    label: "Control Immunity",
    description: "Immune to Stun and Freeze while active.",
    icon: ShieldCheck,
    colorClass: "text-zinc-400",
  },
  stunned: {
    label: "Stunned",
    description: "Loses their next turn.",
    icon: keywordIcons.stun,
    colorClass: keywordDefinitions.stun.colorClass,
  },
  frozen: {
    label: "Frozen",
    description: "Loses their next turn.",
    icon: keywordIcons.freeze,
    colorClass: keywordDefinitions.freeze.colorClass,
  },
  playNextCardTwice: {
    label: "Shadowstep",
    description: "Your next card is played twice.",
    icon: Copy,
    colorClass: "text-violet-300",
  },
  nextHitCrit: {
    label: "Predator's Focus",
    description: "Your next damaging card is a critical strike.",
    icon: Focus,
    colorClass: "text-amber-200",
  },
  nextHitLeech: {
    label: "Predator's Hunger",
    description: "Your next damaging card has Leech.",
    icon: keywordIcons.leech,
    colorClass: keywordDefinitions.leech.colorClass,
  },
  nextHitPoison: {
    label: "Poison Dagger",
    description: "Your next attack is converted to Poison damage.",
    icon: keywordIcons.poison,
    colorClass: keywordDefinitions.poison.colorClass,
  },
  nextHitPhysicalBonus: {
    label: "Opening",
    description: "Your next attack deals additional Physical damage.",
    icon: keywordIcons.physical,
    colorClass: keywordDefinitions.physical.colorClass,
  },
  nextPhysicalDealsBleed: {
    label: "Parting Cut",
    description: "Your next Physical card deals half its damage as Bleed damage.",
    icon: keywordIcons.bleed,
    colorClass: keywordDefinitions.bleed.colorClass,
  },
  nextArcheryCardFree: {
    label: "Arrow Dance",
    description: "Your next Archery card is free.",
    icon: keywordIcons.archery,
    colorClass: keywordDefinitions.archery.colorClass,
  },
  nextHolyCardFree: {
    label: "Divine Favor",
    description: "Your next Holy card is free.",
    icon: keywordIcons.holy,
    colorClass: keywordDefinitions.holy.colorClass,
  },
  nextNatureCardFree: {
    label: "Windstep",
    description: "Your next Nature card is free.",
    icon: keywordIcons.nature,
    colorClass: keywordDefinitions.nature.colorClass,
  },
  dodgeNextAttack: {
    label: "Evasion",
    description: "Dodge the next incoming attack.",
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
