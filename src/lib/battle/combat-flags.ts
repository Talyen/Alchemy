export const FLAG_DEFINITIONS = {
  hawkEyeReady: { default: false as const, secondaryValue: null, lifetime: "until-consumed" },
  killRewardsPaid: { default: false as const, secondaryValue: null, lifetime: "combat" },
  nextHolyCardFree: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextWishExtraChoice: { default: false as const, secondaryValue: null, lifetime: "until-consumed" },
  pendingWishMana: { default: 0 as const, secondaryValue: null, lifetime: "player-turn" },
  previousCardWasArchery: { default: false as const, secondaryValue: null, lifetime: "player-turn" },
  previousCardWasNature: { default: false as const, secondaryValue: null, lifetime: "player-turn" },
  archeryCardsPlayedThisTurn: { default: 0 as const, secondaryValue: 0 as const, lifetime: "player-turn" },
  archerySecondCardActive: { default: false as const, secondaryValue: false as const, lifetime: "player-turn" },
  companionNextAttackBonus: { default: 0 as const, secondaryValue: null, lifetime: "until-consumed" },
  sanguinePhysicalBonus: { default: 0 as const, secondaryValue: null, lifetime: "until-consumed" },
  darkRecoveryMana: { default: 0 as const, secondaryValue: null, lifetime: "player-turn" },
  encounterPhysicalUsed: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  encounterHolyUsed: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  encounterNatureUsed: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  encounterWishUsed: { default: false as const, secondaryValue: null, lifetime: "player-turn" },
  encounterArcheryUsed: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  secondWindTriggered: { default: false as const, secondaryValue: null, lifetime: "combat" },
  uniqueRepeatActive: { default: false as const, secondaryValue: null, lifetime: "combat" },
  firstHolyCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstBurnCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstBurnCardDoubledUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstArmorCardDoubledUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstPoisonCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstBleedCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstBurnTrinketDoubledUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstLeechCardDoubledUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstConsumeCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstCompanionCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },
  firstArcheryCardFreeUsed: { default: false as const, secondaryValue: true as const, lifetime: "combat" },

  // Secondary actions may grant, but never spend, this future-card discount.
  nextCardCostReduction: { default: 0 as const, secondaryValue: 0 as const, lifetime: "until-consumed" },

  goldOnFirstPoisonThisCombat: { default: false as const, secondaryValue: null, lifetime: "combat" },

  resonantChimeUsedThisTurn: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  runicQuillUsedThisTurn: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  consumeDrawUsedThisTurn: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  pendingCinderSkinReaction: { default: false as const, secondaryValue: null, lifetime: "combat" },
  pendingEmberwakeDamage: { default: false as const, secondaryValue: null, lifetime: "combat" },
  cinderSkinUsedThisTurn: { default: false as const, secondaryValue: null, lifetime: "player-turn" },
  holyRetributionUsedThisTurn: { default: false as const, secondaryValue: true as const, lifetime: "player-turn" },
  spitefulHealedThisTurn: { default: false as const, secondaryValue: null, lifetime: "player-turn" },
  spellrendingUsedThisTurn: { default: false as const, secondaryValue: null, lifetime: "player-turn" },

  divineAegisTriggered: { default: false as const, secondaryValue: null, lifetime: "combat" },
  desperateGuardUsed: { default: false as const, secondaryValue: null, lifetime: "combat" },

  nextHitCrit: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextPhysicalCrit: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextHitLeech: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  playNextCardTwice: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextHitPoison: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextHitPhysicalBonus: { default: 0 as const, secondaryValue: 0 as const, lifetime: "until-consumed" },
  nextPhysicalDealsBleed: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextArcheryCardFree: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },
  nextNatureCardFree: { default: false as const, secondaryValue: false as const, lifetime: "until-consumed" },

  enemyFirstHitDoubleUsed: { default: false as const, secondaryValue: null, lifetime: "combat" },
  legacyEnemyThornsReady: { default: false as const, secondaryValue: null, lifetime: "combat" },
  enemyBrawlerDamagePenalty: { default: false as const, secondaryValue: null, lifetime: "combat" },
} as const satisfies Record<
  string,
  {
    default: boolean | number;
    secondaryValue: boolean | number | null;
    lifetime: "player-turn" | "combat" | "until-consumed";
  }
>;

type FlagId = keyof typeof FLAG_DEFINITIONS;
export type CombatFlags = {
  [K in FlagId]: (typeof FLAG_DEFINITIONS)[K]["default"] extends boolean ? boolean : number;
};

export function createInitialFlags(): CombatFlags {
  return Object.fromEntries(
    Object.entries(FLAG_DEFINITIONS).map(([k, def]) => [k, (def as { default: unknown }).default]),
  ) as CombatFlags;
}

/** Preserve combat-scoped and unspent next-action flags across turn boundaries. */
export function resetTurnFlags(flags: CombatFlags): CombatFlags {
  return { ...flags, ...TURN_FLAG_DEFAULTS };
}

const TURN_FLAG_DEFAULTS = Object.fromEntries(
  Object.entries(FLAG_DEFINITIONS)
    .filter(([, definition]) => definition.lifetime === "player-turn")
    .map(([key, definition]) => [key, definition.default]),
) as Partial<CombatFlags>;
