import { cardHasDamageType, cardHasKeyword, isNatureCard } from "./card-classification";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { isPotionCard } from "@/lib/game-data/cards/card-pools";
import { type BattleState, type CombatFlags } from "./types";

type BooleanCombatFlag = {
  [K in keyof CombatFlags]: CombatFlags[K] extends boolean ? K : never;
}[keyof CombatFlags];

type CardCostState = Pick<
  BattleState,
  "flags" | "talentEffects" | "trinketEffects" | "gearEffects" | "uniqueGear" | "encounterBenefits"
>;

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
      state.talentEffects.firstCompanionCardFree && getCardKeywords(card).includes("companion"),
  },
  {
    flag: "firstArcheryCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstArcheryCardFree && !!card.tags?.includes("archery"),
  },
];

function applyCostDiscount(cost: number, reduction: number): number {
  return reduction > 0 ? Math.max(0, cost - reduction) : cost;
}

function checkTrinketFreePotion(state: CardCostState, card: BattleCard): boolean {
  return !state.flags.firstPotionFreeUsed && state.trinketEffects.mortarPestleFreeFirstPotion && isPotionCard(card);
}

function computeStandardCost(
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

export function computeEffectiveCost(state: CardCostState, card: BattleCard) {
  const result = computeStandardCost(state, card);
  const fleeting = card.consume && hasEncounterBenefit(state, "fleeting");
  const quickdraw =
    card.tags?.includes("archery") && hasEncounterBenefit(state, "quickdraw") && !state.flags.encounterArcheryUsed;
  const encounterDiscount =
    (fleeting ? LABYRINTH_MODIFIER_CONFIG.costReduction : 0) +
    (quickdraw ? LABYRINTH_MODIFIER_CONFIG.costReduction : 0);
  if (quickdraw) result.consumedFlags.add("encounterArcheryUsed");
  const gear = state.gearEffects;
  const unique = state.uniqueGear;
  const elementalFree =
    gear.firstElementalCardsFree > 0 &&
    ((cardHasKeyword(card, "burn") && !unique.freeBurnUsed) ||
      (cardHasKeyword(card, "freeze") && !unique.freeFreezeUsed) ||
      (cardHasKeyword(card, "holy") && !unique.freeHolyUsed));
  const natureFree = gear.dodgeReadiesNatureCrit > 0 && unique.wildheartReady && isNatureCard(card);
  const physicalFree =
    gear.blockReadiesFreePhysical > 0 && unique.knightsAnswerReady && cardHasDamageType(card, "physical");
  const returned =
    card.uid !== undefined &&
    ((gear.returnFirstPhysicalCard > 0 && card.uid === unique.redHarvestUid) ||
      (gear.recoverLastArcheryCard > 0 && card.uid === unique.returningFlightUid));
  return {
    ...result,
    effectiveCost:
      elementalFree || natureFree || physicalFree
        ? 0
        : Math.max(
            0,
            result.effectiveCost - encounterDiscount - (returned ? UNIQUE_GEAR_COMBAT.returnedCardDiscount : 0),
          ),
  };
}

export function computeCardPayment(state: BattleState, card: BattleCard) {
  const cost = computeEffectiveCost(state, card);
  const missingMana = Math.max(0, cost.effectiveCost - state.mana);
  const usesBlock = missingMana > 0 && state.gearEffects.blockPaysFreezeMana > 0 && cardHasKeyword(card, "freeze");
  const blockCost = usesBlock ? missingMana * UNIQUE_GEAR_COMBAT.winterBlockPerMana : 0;
  return {
    ...cost,
    blockCost,
    affordable: missingMana === 0 || (usesBlock && state.playerStatuses.block >= blockCost),
  };
}
