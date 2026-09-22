import { readCombatFlag } from "./action-context";
import { cardHasDamageType, cardHasKeyword, isNatureCard } from "./card-classification";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import { type BattleSnapshot, type CombatFlags } from "./types";

type BooleanCombatFlag = {
  [K in keyof CombatFlags]: CombatFlags[K] extends boolean ? K : never;
}[keyof CombatFlags];

type CardCostState = { action?: import("./action-context").BattleActionContext } & Pick<
  BattleSnapshot,
  "flags" | "talentEffects" | "gearEffects" | "uniqueGear" | "encounterBenefits"
>;

const FIRST_CARD_FREE_RULES: Array<{
  flag: BooleanCombatFlag;
  condition: (state: CardCostState, card: BattleCard) => boolean;
}> = [
  {
    flag: "firstBurnCardFreeUsed",
    condition: (state, card) => state.talentEffects.firstBurnCardFree && cardHasKeyword(card, "burn"),
  },
  {
    flag: "firstHolyCardFreeUsed",
    condition: (state, card) =>
      state.talentEffects.firstHolyCardFree && (cardHasKeyword(card, "holy") || cardHasDamageType(card, "holy")),
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
    condition: (state, card) => state.talentEffects.firstArcheryCardFree && cardHasKeyword(card, "archery"),
  },
];

function applyCostDiscount(cost: number, reduction: number): number {
  return reduction > 0 ? Math.max(0, cost - reduction) : cost;
}

function computeStandardCost(
  state: CardCostState,
  card: BattleCard,
  discountedCost: number,
): {
  effectiveCost: number;
  consumedFlags: Set<BooleanCombatFlag>;
  disarmedFlags: Set<BooleanCombatFlag>;
  spentArmedDiscount: boolean;
} {
  const consumedFlags = new Set<BooleanCombatFlag>();
  const disarmedFlags = new Set<BooleanCombatFlag>();

  if (card.cost === 0) {
    return { effectiveCost: 0, consumedFlags, disarmedFlags, spentArmedDiscount: false };
  }

  for (const rule of FIRST_CARD_FREE_RULES) {
    if (!readCombatFlag(state, rule.flag) && rule.condition(state, card)) {
      return {
        effectiveCost: 0,
        consumedFlags: consumedFlags.add(rule.flag),
        disarmedFlags,
        spentArmedDiscount: false,
      };
    }
  }

  if (discountedCost === 0) {
    return { effectiveCost: 0, consumedFlags, disarmedFlags, spentArmedDiscount: false };
  }

  const armedReduction = readCombatFlag(state, "nextCardCostReduction");
  let effectiveCost = applyCostDiscount(discountedCost, armedReduction);
  const spentArmedDiscount = armedReduction > 0 && effectiveCost < discountedCost;
  if (effectiveCost === 0) return { effectiveCost, consumedFlags, disarmedFlags, spentArmedDiscount };

  if (readCombatFlag(state, "nextHolyCardFree") && (cardHasKeyword(card, "holy") || cardHasDamageType(card, "holy"))) {
    effectiveCost = 0;
    disarmedFlags.add("nextHolyCardFree");
  }
  if (effectiveCost === 0) return { effectiveCost, consumedFlags, disarmedFlags, spentArmedDiscount };

  // A dual-keyword card with both flags spends archery first; nature survives
  // for the next card. Priority is array order here, matching FIRST_CARD_FREE_RULES.
  if (readCombatFlag(state, "nextArcheryCardFree") && cardHasKeyword(card, "archery")) {
    effectiveCost = 0;
    disarmedFlags.add("nextArcheryCardFree");
  } else if (readCombatFlag(state, "nextNatureCardFree") && isNatureCard(card)) {
    effectiveCost = 0;
    disarmedFlags.add("nextNatureCardFree");
  }

  return { effectiveCost, consumedFlags, disarmedFlags, spentArmedDiscount };
}

function getEncounterCostDiscount(
  state: CardCostState,
  card: BattleCard,
): { discount: number; quickdrawUsed: boolean } {
  const fleeting = card.consume && hasEncounterBenefit(state, "fleeting");
  const quickdraw =
    card.cost > 0 &&
    cardHasKeyword(card, "archery") &&
    hasEncounterBenefit(state, "quickdraw") &&
    !readCombatFlag(state, "encounterArcheryUsed");
  const discount =
    (fleeting ? LABYRINTH_MODIFIER_CONFIG.costReduction : 0) +
    (quickdraw ? LABYRINTH_MODIFIER_CONFIG.costReduction : 0);
  return { discount, quickdrawUsed: quickdraw };
}

type UniqueCostDiscounts = Partial<
  Pick<
    BattleSnapshot["uniqueGear"],
    "knightsAnswerReady" | "freeBurnUsed" | "freeFreezeUsed" | "freeHolyUsed" | "returningFlightUid"
  >
>;

function resolveGearCostTriggers(
  gear: CardCostState["gearEffects"],
  unique: CardCostState["uniqueGear"],
  card: BattleCard,
): { isFree: boolean; returnedDiscount: number; uniqueDiscounts: UniqueCostDiscounts } {
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

  const uniqueDiscounts: UniqueCostDiscounts = {};
  if (card.cost > 0) {
    if (physicalFree) uniqueDiscounts.knightsAnswerReady = false;
    if (gear.firstElementalCardsFree > 0) {
      if (cardHasKeyword(card, "burn")) uniqueDiscounts.freeBurnUsed = true;
      if (cardHasKeyword(card, "freeze")) uniqueDiscounts.freeFreezeUsed = true;
      if (cardHasKeyword(card, "holy")) uniqueDiscounts.freeHolyUsed = true;
    }
  }
  if (card.uid === unique.returningFlightUid) uniqueDiscounts.returningFlightUid = null;

  return {
    isFree: elementalFree || natureFree || physicalFree,
    returnedDiscount: returned ? UNIQUE_GEAR_COMBAT.returnedCardDiscount : 0,
    uniqueDiscounts,
  };
}

export function computeEffectiveCost(state: CardCostState, card: BattleCard) {
  const { discount, quickdrawUsed } = getEncounterCostDiscount(state, card);
  const { isFree, returnedDiscount, uniqueDiscounts } = resolveGearCostTriggers(
    state.gearEffects,
    state.uniqueGear,
    card,
  );
  const discountedCost = isFree ? 0 : Math.max(0, card.cost - discount - returnedDiscount);
  const result = computeStandardCost(state, card, discountedCost);
  if (quickdrawUsed) result.consumedFlags.add("encounterArcheryUsed");
  return { ...result, uniqueDiscounts };
}

export function computeCardPayment(state: BattleSnapshot, card: BattleCard) {
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
