/** Single source for CombatFlags — defaults, preservation, and type generation. */

export const FLAG_DEFINITIONS = {
  // one-shot per combat (first card free / doubled)
  firstHolyCardFreeUsed: { default: false as const, preserveAs: true as const },
  firstBurnCardDoubledUsed: { default: false as const, preserveAs: true as const },
  firstArmorCardDoubledUsed: { default: false as const, preserveAs: true as const },
  firstPoisonCardFreeUsed: { default: false as const, preserveAs: true as const },
  firstBleedCardFreeUsed: { default: false as const, preserveAs: true as const },
  firstHolyDamageBonusUsed: { default: false as const, preserveAs: true as const },
  firstBurnTrinketDoubledUsed: { default: false as const, preserveAs: true as const },
  firstHarmfulStatusPrevented: { default: false as const, preserveAs: null },
  firstPotionFreeUsed: { default: false as const, preserveAs: true as const },
  firstLeechCardDoubledUsed: { default: false as const, preserveAs: true as const },
  firstConsumeCardFreeUsed: { default: false as const, preserveAs: true as const },
  firstCompanionCardFreeUsed: { default: false as const, preserveAs: true as const },
  firstArcheryCardFreeUsed: { default: false as const, preserveAs: true as const },
  // numeric discount / bonus
  nextCardCostReduction: { default: 0 as const, preserveAs: 0 as const },
  // per-combat once (not preserved — companion/pulses may interact)
  goldOnFirstPoisonThisCombat: { default: false as const, preserveAs: null },
  // per-turn (reset each player turn, preserved for non-card actions)
  resonantChimeUsedThisTurn: { default: false as const, preserveAs: true as const },
  runicQuillUsedThisTurn: { default: false as const, preserveAs: true as const },
  consumeDrawUsedThisTurn: { default: false as const, preserveAs: true as const },
  // lifecycle (triggered once per battle)
  divineAegisTriggered: { default: false as const, preserveAs: null },
  saintfallRetributionTriggered: { default: false as const, preserveAs: null },
  // next-hit active (set by play, consumed on hit)
  nextHitCrit: { default: false as const, preserveAs: false as const },
  playNextCardTwice: { default: false as const, preserveAs: false as const },
  nextHitPoison: { default: false as const, preserveAs: false as const },
  nextHitPhysicalBonus: { default: 0 as const, preserveAs: 0 as const },
  nextPhysicalDealsBleed: { default: false as const, preserveAs: false as const },
  nextArcheryCardFree: { default: false as const, preserveAs: false as const },
  nextNatureCardFree: { default: false as const, preserveAs: false as const },
} as const;

export type FlagId = keyof typeof FLAG_DEFINITIONS;
export type CombatFlags = {
  [K in FlagId]: (typeof FLAG_DEFINITIONS)[K]["default"] extends boolean ? boolean : number;
};

// Subset preserved for non-card actions (companion / pending pulses)
export const PRESERVED_FLAG_VALUES = Object.fromEntries(
  Object.entries(FLAG_DEFINITIONS)
    .filter(([, def]) => (def as { preserveAs: unknown }).preserveAs !== null)
    .map(([key, def]) => [key, (def as { preserveAs: unknown }).preserveAs]),
) as { [K in FlagId as (typeof FLAG_DEFINITIONS)[K]["preserveAs"] extends null ? never : K]: CombatFlags[K] };

export type PreservedFlagKey = keyof typeof PRESERVED_FLAG_VALUES;
export const PRESERVED_FLAG_KEYS = Object.keys(PRESERVED_FLAG_VALUES) as PreservedFlagKey[];

// One-shot keys that must be set to "used" before non-card mutates
export type FirstTimeFlagKey =
  | "firstHolyCardFreeUsed"
  | "firstBurnCardDoubledUsed"
  | "firstArmorCardDoubledUsed"
  | "firstPoisonCardFreeUsed"
  | "firstBleedCardFreeUsed"
  | "firstHolyDamageBonusUsed"
  | "firstBurnTrinketDoubledUsed"
  | "firstLeechCardDoubledUsed"
  | "firstConsumeCardFreeUsed"
  | "firstCompanionCardFreeUsed"
  | "firstArcheryCardFreeUsed"
  | "firstPotionFreeUsed"
  | "nextCardCostReduction"
  | "resonantChimeUsedThisTurn"
  | "runicQuillUsedThisTurn"
  | "consumeDrawUsedThisTurn";

export function createInitialFlags(): CombatFlags {
  return Object.fromEntries(
    Object.entries(FLAG_DEFINITIONS).map(([k, def]) => [k, (def as { default: unknown }).default]),
  ) as CombatFlags;
}
