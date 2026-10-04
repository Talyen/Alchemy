import { readCombatFlag } from "./action-context";
import { cardHasDamageType, cardHasKeyword, isNatureCard } from "./card-classification";
import { hasEncounterBenefit } from "./types";
import { LABYRINTH_MODIFIER_CONFIG } from "../game-constants";
import { UNIQUE_GEAR_COMBAT } from "../game-constants";
import type { BattleCard } from "@/lib/game-data";
import { type BattleSnapshot, type CombatFlags } from "./types";

type BooleanCombatFlag = {
  [K in keyof CombatFlags]: CombatFlags[K] extends boolean ? K : never;
}[keyof CombatFlags];

type CardCostState = { action?: import("./action-context").BattleActionContext } & Pick<
  BattleSnapshot,
  "flags" | "talentEffects" | "gearEffects" | "uniqueGear" | "encounterBenefits"
>;

type FirstCardFreeTalent = Extract<keyof CardCostState["talentEffects"], `first${string}CardFree`>;

const FIRST_CARD_FREE_RULES: ReadonlyArray<
  readonly [talent: FirstCardFreeTalent, usedFlag: BooleanCombatFlag, matches: (card: BattleCard) => boolean]
> = [
  ["firstBurnCardFree", "firstBurnCardFreeUsed", (card) => cardHasKeyword(card, "burn")],
  [
    "firstHolyCardFree",
    "firstHolyCardFreeUsed",
    (card) => cardHasKeyword(card, "holy") || cardHasDamageType(card, "holy"),
  ],
  ["firstPoisonCardFree", "firstPoisonCardFreeUsed", (card) => cardHasDamageType(card, "poison")],
  ["firstBleedCardFree", "firstBleedCardFreeUsed", (card) => cardHasDamageType(card, "bleed")],
  ["firstConsumeCardFree", "firstConsumeCardFreeUsed", (card) => !!card.consume],
  ["firstCompanionCardFree", "firstCompanionCardFreeUsed", (card) => cardHasKeyword(card, "companion")],
  ["firstArcheryCardFree", "firstArcheryCardFreeUsed", (card) => cardHasKeyword(card, "archery")],
];

function applyCostDiscount(cost: number, reduction: number): number {
  return reduction > 0 ? Math.max(0, cost - reduction) : cost;
}

function computeStandardCost(state: CardCostState, card: BattleCard, discountedCost: number) {
  const result = {
    effectiveCost: 0,
    consumedFlags: new Set<BooleanCombatFlag>(),
    disarmedFlags: new Set<BooleanCombatFlag>(),
    spentArmedDiscount: false,
  };
  if (card.cost === 0) return result;

  const firstFree = FIRST_CARD_FREE_RULES.find(
    ([talent, flag, matches]) => state.talentEffects[talent] && !readCombatFlag(state, flag) && matches(card),
  );
  if (firstFree) {
    const [, usedFlag] = firstFree;
    result.consumedFlags.add(usedFlag);
    return result;
  }
  if (discountedCost === 0) return result;

  const armedReduction = readCombatFlag(state, "nextCardCostReduction");
  result.effectiveCost = applyCostDiscount(discountedCost, armedReduction);
  result.spentArmedDiscount = armedReduction > 0 && result.effectiveCost < discountedCost;
  if (result.effectiveCost === 0) return result;

  // Holy, then Archery, then Nature: spend only the first matching opportunity.
  let freeFlag: BooleanCombatFlag | undefined;
  if (readCombatFlag(state, "nextHolyCardFree") && (cardHasKeyword(card, "holy") || cardHasDamageType(card, "holy"))) {
    freeFlag = "nextHolyCardFree";
  } else if (readCombatFlag(state, "nextArcheryCardFree") && cardHasKeyword(card, "archery")) {
    freeFlag = "nextArcheryCardFree";
  } else if (readCombatFlag(state, "nextNatureCardFree") && isNatureCard(card)) {
    freeFlag = "nextNatureCardFree";
  }
  if (freeFlag) {
    result.effectiveCost = 0;
    result.disarmedFlags.add(freeFlag);
  }
  return result;
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

type UniqueCostDiscounts = Partial<Pick<BattleSnapshot["uniqueGear"], "knightsAnswerReady" | "returningFlightUid">>;

function resolveGearCostTriggers(
  gear: CardCostState["gearEffects"],
  unique: CardCostState["uniqueGear"],
  card: BattleCard,
): { isFree: boolean; returnedDiscount: number; uniqueDiscounts: UniqueCostDiscounts } {
  const natureFree = gear.dodgeReadiesNatureCrit > 0 && unique.wildheartReady && isNatureCard(card);
  const physicalFree =
    gear.blockReadiesFreePhysical > 0 && unique.knightsAnswerReady && cardHasDamageType(card, "physical");
  const returned = card.uid !== undefined && gear.recoverLastArcheryCard > 0 && card.uid === unique.returningFlightUid;

  const uniqueDiscounts: UniqueCostDiscounts = {};
  if (card.cost > 0) {
    if (physicalFree) uniqueDiscounts.knightsAnswerReady = false;
  }
  if (card.uid === unique.returningFlightUid) uniqueDiscounts.returningFlightUid = null;

  return {
    isFree: natureFree || physicalFree,
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
  // First-card Talents take priority and leave the Unique free-card opportunity armed.
  if (result.consumedFlags.size > 0) delete uniqueDiscounts.knightsAnswerReady;
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
