import { prepareTalentCardPlay } from "./talent-card-play";
import type { CardEffectResolutionContext } from "./effect-handlers/handler-types";
import { drawFromState, applyDrawResult } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
  payKillPayouts,
} from "./combat-text";
import { isPotionCard, type BattleCard, type EnemyAttackEffect } from "@/lib/game-data";
import {
  type BattleResolution,
  type BattleState,
  type CombatFlags,
  type CombatTextEvent,
  isPlayerDefeated,
  addEnemyStatus,
} from "./types";
import { countRemovableHarmfulStatuses } from "./status-player";
import { processEncounterTraitCardAction } from "./encounter-trait-events";
import { getBattleRng, rngInt, rollPercent } from "@/lib/rng";
import { dealPlayerTypedHit } from "./player-typed-hit";
import { dealEnemyScaledDamage } from "./gear-effects";
import { decayArmorAfterDamage, getEnemyDamageMultiplier } from "./status-helpers";
import { processEncounterTraitHealthThreshold } from "./encounter-trait-health-threshold";

import { prepareUniqueCardPlay, finishUniqueCardDamage, returnHarvestCard } from "./unique-card-effects";
import { computeCardPayment } from "./card-cost-rules";
import { cardHasKeyword, isNatureCard } from "./card-classification";
import { isPlayerCcControlled } from "./status-cc";
import { MAX_HAND_SIZE, WISH_TRINKET_FORK_PERCENT } from "../game-constants";

function consumeCardDiscounts(state: BattleState, payment: ReturnType<typeof computeCardPayment>): BattleState {
  const { consumedFlags, disarmedFlags } = payment;
  if (consumedFlags.size === 0 && disarmedFlags.size === 0) {
    return state;
  }
  const nextFlags: CombatFlags = { ...state.flags };
  for (const flag of consumedFlags) nextFlags[flag] = true;
  for (const flag of disarmedFlags) nextFlags[flag] = false;
  return { ...state, flags: nextFlags };
}

function getPlayableCard(state: BattleState, cardId: string, index: number): BattleCard | null {
  if (state.wishOptions) return null;
  const card = state.hand[index];
  if (!card || card.id !== cardId) return null;
  return card;
}

export interface CardPlayOptions {
  allowAfterEnemyDefeat?: boolean;
}

function cardHasOnlyCleanseEffect(card: BattleCard, state: BattleState): boolean {
  if (!card.effects.some((effect) => effect.kind === "remove-harmful-status")) return false;
  const hasUsefulEffect = card.effects.some(
    (effect) => effect.kind !== "remove-harmful-status" && effect.kind !== "self-damage",
  );
  return !hasUsefulEffect && countRemovableHarmfulStatuses(state.playerStatuses) === 0;
}

function isCardInHand(state: BattleState, card: BattleCard, index: number): boolean {
  const currentCard = state.hand[index];
  return !!currentCard && currentCard.id === card.id && currentCard.uid === card.uid;
}

function applyMortarAndPestlePotionUse(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]) {
  if (!isPotionCard(card) || state.trinketEffects.mortarPestlePoisonOnPotionUse <= 0) return state;
  return dealPlayerTypedHit(state, "poison", state.trinketEffects.mortarPestlePoisonOnPotionUse, combatTexts);
}

function validateCardPlay(
  state: BattleState,
  card: BattleCard,
  index: number,
  options?: CardPlayOptions,
): ReturnType<typeof computeCardPayment> | null {
  if (state.enemyHealth <= 0 && !options?.allowAfterEnemyDefeat) return null;
  if (isPlayerDefeated(state)) return null;
  if (state.wishOptions) return null;
  if (state.turnPhase !== "player") return null;
  if (isPlayerCcControlled(state.playerCC)) return null;
  if (!isCardInHand(state, card, index)) return null;
  const payment = computeCardPayment(state, state.hand[index]!);
  if (!payment.affordable) return null;
  if (cardHasOnlyCleanseEffect(card, state)) return null;
  return payment;
}

export function canPlayCard(state: BattleState, card: BattleCard, index: number, options?: CardPlayOptions): boolean {
  return validateCardPlay(state, card, index, options) !== null;
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
): BattleState {
  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, nextCardCostReduction: 0, playNextCardTwice: false },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
    mana: Math.max(0, state.mana - effectiveCost),
  };

  const talentPlay = prepareTalentCardPlay(nextState, card, combatTexts);
  nextState = talentPlay.state;
  const playContext = {
    attackBonuses: talentPlay.attackBonuses,
    cardHealing: true,
    playedCard: true,
    damageEffects,
    guaranteedCrit,
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
  };
  nextState = applyCardEffects(nextState, card, combatTexts, playContext);
  nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);

  if (playTwice) {
    nextState = applyCardEffects(nextState, card, combatTexts, { ...playContext, damageEffects: [] });
    nextState = applyMortarAndPestlePotionUse(nextState, card, combatTexts);
  }

  nextState = applyNatureCardPlayTalents(nextState, card, combatTexts);

  nextState = applyTwinCasting(nextState, card);

  return nextState;
}

function applyTwinCasting(state: BattleState, card: BattleCard): BattleState {
  if (state.gearEffects.elementalTwinCasting <= 0) return state;
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

  const eligibleIndices: number[] = [];
  for (let i = 0; i < state.deck.length; i++) {
    const candidate = state.deck[i];
    if (candidate && cardHasKeyword(candidate, targetType)) {
      eligibleIndices.push(i);
    }
  }
  if (eligibleIndices.length === 0) return state;
  const pick = rngInt(getBattleRng(state), eligibleIndices.length);
  const targetIndex = eligibleIndices[pick] ?? eligibleIndices[0]!;
  const rawDrawnCard = state.deck[targetIndex];
  if (!rawDrawnCard) return state;

  const drawnCard = { ...rawDrawnCard, uid: state.nextCardUid };
  const nextDeck = [...state.deck.slice(0, targetIndex), ...state.deck.slice(targetIndex + 1)];
  return {
    ...state,
    deck: nextDeck,
    hand: [...state.hand, drawnCard],
    nextCardUid: state.nextCardUid + 1,
  };
}

function applyResonantChimeTrinket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const { resonantChimeCardsRequired, resonantChimeMana } = state.trinketEffects;
  if (
    resonantChimeCardsRequired > 0 &&
    resonantChimeMana > 0 &&
    !state.flags.resonantChimeUsedThisTurn &&
    state.cardsPlayedThisTurn >= resonantChimeCardsRequired
  ) {
    const afterMana = gainManaWithCombatText(state, resonantChimeMana, combatTexts);
    if (afterMana.mana <= state.mana) return state;
    return { ...afterMana, flags: { ...state.flags, resonantChimeUsedThisTurn: true } };
  }
  return state;
}

function applyNatureCardPlayTalents(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (!isNatureCard(card)) return state;
  let nextState = state;
  if (nextState.talentEffects.blockOnNatureCard > 0) {
    nextState = addPlayerStatusWithCombatText(
      nextState,
      "block",
      nextState.talentEffects.blockOnNatureCard,
      combatTexts,
    );
  }
  if (nextState.talentEffects.healOnNatureCard > 0) {
    nextState = applyHealingWithCombatText(nextState, nextState.talentEffects.healOnNatureCard, combatTexts);
  }
  return nextState;
}

function cardIsSummonCompanion(card: BattleCard): boolean {
  return card.effects.some((effect) => effect.kind === "summon-companion");
}

function applyConsumeTalentRiders(state: BattleState, card: BattleCard, combatTexts?: CombatTextEvent[]): BattleState {
  if (cardIsSummonCompanion(card)) return state;
  const talents = state.talentEffects;
  let nextState = state;

  if (talents.healOnConsume > 0) {
    nextState = applyHealingWithCombatText(nextState, talents.healOnConsume, combatTexts);
  }
  if (talents.goldOnConsume > 0) {
    nextState = addGoldWithCombatText(nextState, talents.goldOnConsume, combatTexts);
  }
  if (talents.drawOnConsume > 0 && !nextState.flags.consumeDrawUsedThisTurn) {
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
  if (talents.blockOnConsume > 0) {
    nextState = addPlayerStatusWithCombatText(nextState, "block", talents.blockOnConsume, combatTexts);
  }
  return nextState;
}

function applyConsumeBurn(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  if (state.enemyHealth <= 0 || state.gearEffects.burnOnConsume <= 0) return state;
  return dealEnemyScaledDamage(state, state.gearEffects.burnOnConsume, "burn", combatTexts, {
    multiplier: getEnemyDamageMultiplier(state, "burn"),
    riders: (damaged, damage, texts) => {
      const burning = addEnemyStatus(damaged, "burn", damage);
      const decayed = decayArmorAfterDamage(burning, damage, "enemy", texts);
      return payKillPayouts(processEncounterTraitHealthThreshold(state.enemyHealth, decayed, texts), true, texts);
    },
  });
}

export function handlePostPlayCardDestination(
  state: BattleState,
  card: BattleCard,
  triggerConsumeRiders = true,
  combatTexts?: CombatTextEvent[],
): BattleState {
  if (card.consume) {
    let nextState = { ...state, exhausted: [...state.exhausted, card] };
    if (triggerConsumeRiders) {
      if (state.trinketEffects.runicQuillDrawOnConsume > 0 && !state.flags.runicQuillUsedThisTurn) {
        const draw = drawFromState(nextState, state.trinketEffects.runicQuillDrawOnConsume);
        nextState = {
          ...applyDrawResult(nextState, draw),
          flags: { ...nextState.flags, runicQuillUsedThisTurn: true },
        };
      }
      nextState = applyConsumeBurn(nextState, combatTexts ?? []);
      nextState = applyConsumeTalentRiders(nextState, card, combatTexts);
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

  const card = getPlayableCard(state, cardId, index);
  if (!card) return { state, combatTexts };
  const payment = validateCardPlay(state, card, index, options);
  if (!payment) return { state, combatTexts };

  const { effectiveCost, blockCost } = payment;
  const costState = consumeCardDiscounts(state, payment);

  const playTwice = costState.flags.playNextCardTwice;
  const prepared = prepareUniqueCardPlay(costState, card, effectiveCost);
  const paymentState = {
    ...prepared.state,
    playerStatuses: { ...prepared.state.playerStatuses, block: prepared.state.playerStatuses.block - blockCost },
  };
  if (blockCost > 0)
    mergeCombatText(combatTexts, { target: "player", kind: "damage", stat: "block", amount: blockCost });
  let nextState = executeCardPlayState(
    paymentState,
    card,
    index,
    effectiveCost,
    combatTexts,
    playTwice,
    prepared.critical,
    prepared.damageEffects,
  );
  nextState = finishUniqueCardDamage(nextState, card, prepared, combatTexts);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  if (playTwice) nextState = processEncounterTraitCardAction(nextState, { ...card, consume: false }, combatTexts);

  const playerAlive = !isPlayerDefeated(nextState);
  if (playerAlive && enemyWasAlive) {
    nextState = applyResonantChimeTrinket(nextState, combatTexts);
  }
  nextState = handlePostPlayCardDestination(nextState, card, playerAlive, combatTexts);
  if (prepared.harvest) nextState = returnHarvestCard(nextState, card);

  return { state: nextState, combatTexts };
}

export function enemyAttackDealsDamage(effects: readonly EnemyAttackEffect[] | null | undefined): boolean {
  return (effects ?? []).some((effect) => effect.kind === "damage");
}
