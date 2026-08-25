import { type BattleCard } from "@/lib/game-data";
import { isPotionCard } from "@/lib/game-data/cards/card-pools";
import { type BattleState, type CombatFlags } from "./types";

type BooleanCombatFlag = {
  [K in keyof CombatFlags]: CombatFlags[K] extends boolean ? K : never;
}[keyof CombatFlags];

function effectHasDamageType(effect: BattleCard["effects"][number], damageType: string): boolean {
  if (effect.kind === "damage" || effect.kind === "cleanse-player-status-to-damage") {
    return effect.damageType === damageType;
  }
  if (effect.kind === "random-damage") {
    return damageType === "physical";
  }
  if (effect.kind === "chance") {
    return [...effect.successEffects, ...effect.failureEffects].some((e) => effectHasDamageType(e, damageType));
  }
  if (effect.kind === "repeat-over-turns") {
    return effect.effects.some((e) => effectHasDamageType(e, damageType));
  }
  return false;
}

/**
 * Checks if a card contains a specific damage type effect.
 * Used for determining keyword affinity and applying first-card-free rules.
 */
export function cardHasDamageType(card: BattleCard, damageType: string): boolean {
  return card.effects.some((e) => effectHasDamageType(e, damageType));
}

/**
 * Checks if a card belongs to the Nature archetype (deals nature damage or has nature tag).
 */
export function isNatureCard(card: BattleCard): boolean {
  return cardHasDamageType(card, "nature") || card.tags?.includes("nature") === true;
}

type CardCostState = Pick<BattleState, "flags" | "talentEffects" | "trinketEffects">;

const FIRST_CARD_FREE_RULES: Array<{
  flag: BooleanCombatFlag;
  condition: (state: CardCostState, card: BattleCard) => boolean;
}> = [
  {
    flag: "firstHolyCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstHolyCardFree && cardHasDamageType(card, "holy"),
  },
  {
    flag: "firstPoisonCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstPoisonCardFree && cardHasDamageType(card, "poison"),
  },
  {
    flag: "firstBleedCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstBleedCardFree && cardHasDamageType(card, "bleed"),
  },
  {
    flag: "firstConsumeCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstConsumeCardFree && !!card.consume,
  },
  {
    flag: "firstCompanionCardFreeUsed",
    condition: (state, card) =>
      state.talentEffects.firstCompanionCardFree && card.effects.some((effect) => effect.kind === "summon-companion"),
  },
  {
    flag: "firstArcheryCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstArcheryCardFree && !!card.tags?.includes("archery"),
  },
];

/**
 * Applies a discount to card cost. Only handles reductions (positive values).
 * Negative values (cost increases) are dropped since no card currently
 * uses that mechanic — if added later, use a separate applyCostPenalty.
 */
function applyCostDiscount(cost: number, reduction: number): number {
  return reduction > 0 ? Math.max(0, cost - reduction) : cost;
}

/**
 * Checks if a boon discount applies to the first potion played.
 */
function checkTrinketFreePotion(state: CardCostState, card: BattleCard): boolean {
  return !state.flags.firstPotionFreeUsed && state.trinketEffects.mortarPestleFreeFirstPotion && isPotionCard(card);
}

/**
 * Pure cost computation shared by UI playability checks and card play (resolveCardPlayCost).
 * Returns the effective cost and which one-shot free-card flags were consumed.
 * When cost is already 0 (e.g. from nextCardCostReduction), free-card flags
 * are intentionally NOT consumed so they remain available for the next meaningful card.
 */
export function computeEffectiveCost(
  state: CardCostState,
  card: BattleCard,
): { effectiveCost: number; consumedFlags: Set<BooleanCombatFlag>; disarmedFlags: Set<BooleanCombatFlag> } {
  let effectiveCost = applyCostDiscount(card.cost, state.flags.nextCardCostReduction);
  const consumedFlags = new Set<BooleanCombatFlag>();
  const disarmedFlags = new Set<BooleanCombatFlag>();

  if (effectiveCost === 0) return { effectiveCost, consumedFlags, disarmedFlags };

  for (const rule of FIRST_CARD_FREE_RULES) {
    if (!state.flags[rule.flag] && rule.condition(state, card)) {
      effectiveCost = 0;
      consumedFlags.add(rule.flag);
      break;
    }
  }
  if (effectiveCost === 0) return { effectiveCost, consumedFlags, disarmedFlags };

  if (checkTrinketFreePotion(state, card)) {
    effectiveCost = 0;
    consumedFlags.add("firstPotionFreeUsed");
  }
  if (effectiveCost === 0) return { effectiveCost, consumedFlags, disarmedFlags };

  if (state.flags.nextArcheryCardFree && !!card.tags?.includes("archery")) {
    effectiveCost = 0;
    disarmedFlags.add("nextArcheryCardFree");
  } else if (state.flags.nextNatureCardFree && isNatureCard(card)) {
    effectiveCost = 0;
    disarmedFlags.add("nextNatureCardFree");
  }

  return { effectiveCost, consumedFlags, disarmedFlags };
}
