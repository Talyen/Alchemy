import { readCombatFlag } from "./action-context";
import { resolvePendingBattleReactions } from "./enemy-attack-damage";
import { prepareTalentCardPlay } from "./talent-card-play";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { drawFromState, applyDrawResult, drawKeywordCard } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import {
  addGoldWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
} from "./combat-text";
import { isPotionCard, type BattleCard } from "@/lib/game-data";
import {
  type BattleResolution,
  type BattleState,
  type BattleSnapshot,
  type CombatFlags,
  type CombatTextEvent,
  isPlayerDefeated,
  addEnemyStatus,
} from "./types";
import { processCompanionTurnStart } from "./companion";
import { detonateEnemyStatuses } from "./dot-resolve";
import {
  addForgeToPlayer,
  applyBlockDepletionForgeReward,
  applyBlockReward,
  countRemovableHarmfulStatuses,
} from "./status-player";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { getBattleRng, rollPercent } from "@/lib/rng";
import { resolveFollowUpHit } from "./follow-up-hit-resolution";
import { rollTalentChance } from "./status-helpers";

import { prepareUniqueCardPlay, finishUniqueCardDamage, returnHarvestCard } from "./unique-card-effects";
import { computeCardPayment } from "./card-cost-rules";
import { cardHasKeyword, isNatureCard } from "./card-classification";
import { isCcControlled } from "./status-cc";
import { MAX_HAND_SIZE, REACTIVE_REWARD_CHANCES, WISH_TRINKET_FORK_PERCENT } from "../game-constants";

function consumeCardDiscounts(state: BattleState, payment: ReturnType<typeof computeCardPayment>): BattleState {
  const { consumedFlags, disarmedFlags, spentArmedDiscount, uniqueDiscounts } = payment;
  if (
    consumedFlags.size === 0 &&
    disarmedFlags.size === 0 &&
    !spentArmedDiscount &&
    Object.keys(uniqueDiscounts).length === 0
  ) {
    return state;
  }
  const nextFlags: CombatFlags = { ...state.flags };
  for (const flag of consumedFlags) nextFlags[flag] = true;
  for (const flag of disarmedFlags) nextFlags[flag] = false;
  if (spentArmedDiscount) nextFlags.nextCardCostReduction = 0;
  return { ...state, flags: nextFlags, uniqueGear: { ...state.uniqueGear, ...uniqueDiscounts } };
}

function getHandCard(state: BattleSnapshot, cardId: string, index: number, uid?: number): BattleCard | null {
  if (state.wishOptions) return null;
  const card = state.hand[index];
  if (!card || card.id !== cardId) return null;
  if (uid !== undefined && card.uid !== uid) return null;
  return card;
}

export interface CardPlayOptions {
  allowAfterEnemyDefeat?: boolean;
}

function cardHasOnlyCleanseEffect(card: BattleCard, state: BattleSnapshot): boolean {
  if (!card.effects.some((effect) => effect.kind === "remove-harmful-status")) return false;
  const hasUsefulEffect = card.effects.some(
    (effect) => effect.kind !== "remove-harmful-status" && effect.kind !== "self-damage",
  );
  return !hasUsefulEffect && countRemovableHarmfulStatuses(state.playerStatuses) === 0;
}

export function applyMortarAndPestlePotionUse(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  if (isPlayerDefeated(state) || !isPotionCard(card) || state.trinketEffects.mortarPestlePoisonOnPotionUse <= 0)
    return state;
  return resolvePendingBattleReactions(
    resolveFollowUpHit(
      state,
      { source: "player-follow-up", damageType: "poison", amount: state.trinketEffects.mortarPestlePoisonOnPotionUse },
      combatTexts,
    ),
    combatTexts,
  );
}

function validateCardPlay(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): ReturnType<typeof computeCardPayment> | null {
  if (state.enemyHealth <= 0 && !options?.allowAfterEnemyDefeat) return null;
  if (isPlayerDefeated(state)) return null;
  if (state.turnPhase !== "player") return null;
  if (isCcControlled(state.playerCC)) return null;
  const handCard = getHandCard(state, card.id, index, card.uid);
  if (!handCard) return null;
  const payment = computeCardPayment(state, handCard);
  if (!payment.affordable) return null;
  if (cardHasOnlyCleanseEffect(card, state)) return null;
  return payment;
}

export function canPlayCard(
  state: BattleSnapshot,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): boolean {
  return validateCardPlay(state, card, index, options) !== null;
}

export interface CardEffectChainOptions {
  playedCard?: boolean;
  guaranteedCrit?: boolean;
  damageEffects?: NonNullable<CardEffectResolutionContext["damageEffects"]>;
  manaAtStart?: number;
  enemyFreezeSkipTurnsAtStart?: number;
  skipTalentRewards?: boolean;
}

// Shared core for playing a card's effects: talent pre-triggers, pending
// reactions, the effect dispatch itself, potion use, and talent rewards.
// Normal plays and dodge-drawn plays differ only in cost handling, unique
// repeats, and twin-casting, which stay with their callers.
export function resolveCardEffectChain(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  options: CardEffectChainOptions = {},
): {
  state: BattleState;
  attackAttempted: boolean;
  attackBonuses: NonNullable<CardEffectResolutionContext["attackBonuses"]>;
} {
  const talentPlay = prepareTalentCardPlay(state, card, combatTexts, {
    countsAsPlayedCard: options.playedCard === true,
  });
  const reacted = resolvePendingBattleReactions(talentPlay.state, combatTexts);
  const damageEffects = options.damageEffects ?? [];
  let nextState = applyCardEffects(reacted, card, combatTexts, {
    attackBonuses: talentPlay.attackBonuses,
    origin: options.playedCard ? "played-card" : "triggered-card",
    damageEffects,
    manaAtStart: options.manaAtStart ?? reacted.mana,
    enemyFreezeSkipTurnsAtStart: options.enemyFreezeSkipTurnsAtStart ?? reacted.enemyCC.freezeSkipTurns,
    ...(options.guaranteedCrit === undefined ? {} : { guaranteedCrit: options.guaranteedCrit }),
  });
  nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
  if (!options.skipTalentRewards) {
    nextState = applyCardPlayTalentRewards(nextState, card, combatTexts);
  }
  return { state: nextState, attackAttempted: damageEffects.length > 0, attackBonuses: talentPlay.attackBonuses };
}

export function shouldElementalTalentRepeat(state: BattleState, card: BattleCard, alreadyRepeating = false): boolean {
  if (alreadyRepeating) return false;

  const chance =
    (cardHasKeyword(card, "burn") ? state.talentEffects.burnCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "freeze") ? state.talentEffects.freezeCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "nature") ? state.talentEffects.natureCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "poison") ? state.talentEffects.poisonCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "stun") ? state.talentEffects.stunCardPlayTwiceChance : 0) +
    (cardHasKeyword(card, "wish") ? state.talentEffects.wishCardPlayTwiceChance : 0);

  return rollTalentChance(Math.min(100, chance), state);
}

function executeCardPlayState(
  state: BattleState,
  card: BattleCard,
  index: number,
  effectiveCost: number,
  combatTexts: CombatTextEvent[],
  playTwice: boolean,
  guaranteedCrit: boolean,
  damageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]>,
) {
  const stripped: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, playNextCardTwice: false },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
    mana: Math.max(0, state.mana - effectiveCost),
  };

  const chained = resolveCardEffectChain(stripped, card, combatTexts, {
    playedCard: true,
    guaranteedCrit,
    damageEffects,
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
    // Play-twice resolves both damage copies before talent rewards so
    // companion/nature triggers fire once after the full play.
    skipTalentRewards: playTwice,
  });
  let nextState = chained.state;

  const repeatedDamageEffects: NonNullable<CardEffectResolutionContext["damageEffects"]> = [];
  if (playTwice) {
    nextState = applyCardEffects(nextState, card, combatTexts, {
      attackBonuses: chained.attackBonuses,
      origin: "played-card",
      damageEffects: repeatedDamageEffects,
      guaranteedCrit,
      manaAtStart: state.mana,
      enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
    });
    nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
    nextState = applyCardPlayTalentRewards(nextState, card, combatTexts);
  }

  nextState = applyTwinCasting(nextState, card);

  return {
    state: nextState,
    attackAttempted: damageEffects.length > 0,
    repeatAttackAttempted: repeatedDamageEffects.length > 0,
  };
}

function applyTwinCasting(state: BattleState, card: BattleCard): BattleState {
  if (isPlayerDefeated(state) || state.gearEffects.elementalTwinCasting <= 0) return state;
  if (state.hand.length >= MAX_HAND_SIZE) return state;

  const hasBurn = cardHasKeyword(card, "burn");
  const hasFreeze = cardHasKeyword(card, "freeze");

  let targetType: "burn" | "freeze" | null = null;
  if (hasBurn && hasFreeze) {
    targetType = rollPercent(WISH_TRINKET_FORK_PERCENT, getBattleRng(state)) ? "freeze" : "burn";
  } else if (hasBurn) {
    targetType = "freeze";
  } else if (hasFreeze) {
    targetType = "burn";
  }
  if (!targetType) return state;
  return drawKeywordCard(state, targetType, { refillFromDiscard: false });
}

function applyResonantChimeTrinket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const { resonantChimeCardsRequired, resonantChimeMana } = state.trinketEffects;
  if (
    resonantChimeCardsRequired > 0 &&
    resonantChimeMana > 0 &&
    !readCombatFlag(state, "resonantChimeUsedThisTurn") &&
    state.cardsPlayedThisTurn >= resonantChimeCardsRequired
  ) {
    const afterMana = gainManaWithCombatText(state, resonantChimeMana, combatTexts);
    if (afterMana.mana <= state.mana) return state;
    return { ...afterMana, flags: { ...state.flags, resonantChimeUsedThisTurn: true } };
  }
  return state;
}

export function applyCardPlayTalentRewards(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
): BattleState {
  if (isPlayerDefeated(state)) return state;
  let nextState = applyNatureCardPlayTalents(state, card, combatTexts);
  if (nextState.talentEffects.companionActsOnCard && cardHasKeyword(card, "companion")) {
    nextState = processCompanionTurnStart(nextState, combatTexts);
  }
  return nextState;
}

function applyNatureCardPlayTalents(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (!isNatureCard(card)) return state;
  let nextState = state;
  if (nextState.talentEffects.blockOnNatureCard > 0) {
    nextState = applyBlockReward(nextState, nextState.talentEffects.blockOnNatureCard, combatTexts);
  }
  if (nextState.talentEffects.healOnNatureCard > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnNatureCard, combatTexts);
  }
  return nextState;
}

function cardIsSummonCompanion(card: BattleCard): boolean {
  return card.effects.some((effect) => effect.kind === "summon-companion");
}

function applyConsumeTalentRiders(
  state: BattleState,
  card: BattleCard,
  combatTexts: CombatTextEvent[],
  lastCardInHand: boolean,
): BattleState {
  if (cardIsSummonCompanion(card)) return state;
  const talents = state.talentEffects;
  let nextState = state;

  if (talents.uncappedDrawOnConsume > 0) {
    nextState = applyDrawResult(nextState, drawFromState(nextState, talents.uncappedDrawOnConsume));
  }
  if (lastCardInHand && talents.forgeOnConsume > 0)
    nextState = addForgeToPlayer(nextState, talents.forgeOnConsume, combatTexts);
  if (
    talents.consumeDetonatesBurn ||
    (talents.consumeDetonatesBurnChance > 0 && rollTalentChance(talents.consumeDetonatesBurnChance, nextState))
  ) {
    nextState = detonateEnemyStatuses(nextState, ["burn"], combatTexts);
  }
  nextState = resolvePendingBattleReactions(nextState, combatTexts);
  if (isPlayerDefeated(nextState)) return nextState;
  if (talents.healOnConsume > 0) {
    nextState = applyHealingWithCombatText(nextState, talents.healOnConsume, combatTexts);
  }
  if (talents.goldOnConsume > 0 && rollTalentChance(REACTIVE_REWARD_CHANCES.leftovers, nextState)) {
    nextState = addGoldWithCombatText(nextState, talents.goldOnConsume, combatTexts);
  }
  if (talents.drawOnConsume > 0 && !readCombatFlag(nextState, "consumeDrawUsedThisTurn")) {
    const draw = drawFromState(nextState, talents.drawOnConsume);
    nextState = {
      ...applyDrawResult(nextState, draw),
      flags: { ...nextState.flags, consumeDrawUsedThisTurn: true },
    };
  }
  if (talents.poisonOnConsume > 0) {
    nextState = addEnemyStatus(nextState, "poison", talents.poisonOnConsume);
    if (combatTexts) {
      mergeCombatText(combatTexts, {
        target: "enemy",
        kind: "status",
        stat: "poison",
        amount: talents.poisonOnConsume,
      });
    }
  }
  return nextState;
}

export function handlePostPlayCardDestination(
  state: BattleState,
  card: BattleCard,
  triggerConsumeRiders = true,
  combatTexts: CombatTextEvent[] = [],
  lastCardInHand = false,
): BattleState {
  if (card.consume) {
    let nextState = { ...state, exhausted: [...state.exhausted, card] };
    if (triggerConsumeRiders) {
      if (state.trinketEffects.runicQuillDrawOnConsume > 0) {
        const draw = drawFromState(nextState, state.trinketEffects.runicQuillDrawOnConsume);
        nextState = applyDrawResult(nextState, draw);
      }
      nextState = applyConsumeTalentRiders(nextState, card, combatTexts, lastCardInHand);
    }
    return nextState;
  }
  return { ...state, discard: [...state.discard, card] };
}

export function playBattleCardResolved(
  state: BattleState,
  cardId: string,
  index: number,
  options?: CardPlayOptions,
): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyWasAlive = state.enemyHealth > 0;

  const card = getHandCard(state, cardId, index);
  if (!card) return { state, combatTexts };
  const payment = validateCardPlay(state, card, index, options);
  if (!payment) return { state, combatTexts };

  const freeMana =
    payment.effectiveCost > 0 &&
    (state.talentEffects.homesteadFreeManaChance ?? 0) > 0 &&
    rollPercent(state.talentEffects.homesteadFreeManaChance, getBattleRng(state));
  const effectiveCost = freeMana ? 0 : payment.effectiveCost;
  const blockCost = freeMana ? 0 : payment.blockCost;
  const costState = freeMana ? state : consumeCardDiscounts(state, payment);

  const existingPlayTwice = readCombatFlag(costState, "playNextCardTwice");
  const playTwice = existingPlayTwice || shouldElementalTalentRepeat(costState, card, existingPlayTwice);
  const prepared = prepareUniqueCardPlay(costState, card, effectiveCost);
  let paymentState = {
    ...prepared.state,
    playerStatuses: { ...prepared.state.playerStatuses, block: prepared.state.playerStatuses.block - blockCost },
  };
  paymentState = applyBlockDepletionForgeReward(costState, paymentState, combatTexts);
  if (blockCost > 0)
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockCost });
  const played = executeCardPlayState(
    paymentState,
    card,
    index,
    effectiveCost,
    combatTexts,
    playTwice,
    prepared.critical,
    prepared.damageEffects,
  );
  let nextState = finishUniqueCardDamage(played.state, card, prepared, combatTexts);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts, played.attackAttempted);
  if (playTwice)
    nextState = processEncounterTraitCardAction(
      nextState,
      { ...card, consume: false },
      combatTexts,
      played.repeatAttackAttempted,
      { cardPlayed: false },
    );

  const playerAlive = !isPlayerDefeated(nextState);
  if (playerAlive && enemyWasAlive) {
    nextState = applyResonantChimeTrinket(nextState, combatTexts);
  }
  nextState = handlePostPlayCardDestination(nextState, card, playerAlive, combatTexts, state.hand.length === 1);
  if (prepared.harvest) nextState = returnHarvestCard(nextState, card);

  return { state: resolvePendingBattleReactions(nextState, combatTexts), combatTexts };
}
