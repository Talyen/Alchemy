import { drawFromState, applyDrawResult } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
} from "./combat-text";
import { type BattleCard, type EnemyAttackEffect } from "@/lib/game-data";
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

import { cardHasDamageType, computeEffectiveCost, isNatureCard } from "./card-cost-rules";
import { MAX_HAND_SIZE, WISH_TRINKET_FORK_PERCENT } from "../game-constants";

function resolveCardPlayCost(state: BattleState, card: BattleCard) {
  const { effectiveCost, consumedFlags, disarmedFlags } = computeEffectiveCost(state, card);
  if (consumedFlags.size === 0 && disarmedFlags.size === 0) {
    return { state, effectiveCost };
  }
  const nextFlags: CombatFlags = { ...state.flags };
  for (const flag of consumedFlags) nextFlags[flag] = true;
  for (const flag of disarmedFlags) nextFlags[flag] = false;
  return { state: { ...state, flags: nextFlags }, effectiveCost };
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

function canAffordCard(state: BattleState, index: number): boolean {
  const currentCard = state.hand[index];
  return !!currentCard && state.mana >= computeEffectiveCost(state, currentCard).effectiveCost;
}

export function canPlayCard(state: BattleState, card: BattleCard, index: number, options?: CardPlayOptions): boolean {
  if (state.enemyHealth <= 0 && !options?.allowAfterEnemyDefeat) return false;
  if (isPlayerDefeated(state)) return false;
  if (state.wishOptions) return false;
  if (state.turnPhase !== "player") return false;
  if (!isCardInHand(state, card, index)) return false;
  if (!canAffordCard(state, index)) return false;
  if (cardHasOnlyCleanseEffect(card, state)) return false;
  return true;
}

function executeCardPlayState(
  state: BattleState,
  card: BattleCard,
  index: number,
  effectiveCost: number,
  combatTexts: CombatTextEvent[],
  playTwice: boolean,
): BattleState {
  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, nextCardCostReduction: 0, playNextCardTwice: false },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
    mana: Math.max(0, state.mana - effectiveCost),
  };

  const playContext = {
    manaAtStart: state.mana,
    enemyFreezeSkipTurnsAtStart: state.enemyCC.freezeSkipTurns,
  };
  nextState = applyCardEffects(nextState, card, combatTexts, playContext);

  if (playTwice) nextState = applyCardEffects(nextState, card, combatTexts, playContext);

  nextState = applyNatureCardPlayTalents(nextState, card, combatTexts);

  if (cardHasDamageType(card, "nature") && state.gearEffects.manaOnNatureDamageChance > 0) {
    if (rollPercent(state.gearEffects.manaOnNatureDamageChance, getBattleRng(state))) {
      nextState = gainManaWithCombatText(nextState, 1, combatTexts);
    }
  }

  nextState = applyTwinCasting(nextState, card);

  return nextState;
}

function applyTwinCasting(state: BattleState, card: BattleCard): BattleState {
  if (state.gearEffects.elementalTwinCasting <= 0) return state;
  if (state.hand.length >= MAX_HAND_SIZE) return state;

  const hasBurn = cardHasDamageType(card, "burn") || card.tags?.includes("burn");
  const hasFreeze = cardHasDamageType(card, "freeze") || card.tags?.includes("freeze");

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
    if (candidate && (cardHasDamageType(candidate, targetType) || candidate.tags?.includes(targetType))) {
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
      if (state.gearEffects.burnOnConsume > 0 && combatTexts) {
        const burnAmount = state.gearEffects.burnOnConsume;
        nextState = addEnemyStatus(nextState, "burn", burnAmount);
        mergeCombatText(combatTexts, {
          target: "enemy",
          kind: "status",
          stat: "burn",
          amount: burnAmount,
        });
      }
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
  if (!card || !canPlayCard(state, card, index, options)) return { state, combatTexts };

  const { state: costState, effectiveCost } = resolveCardPlayCost(state, card);

  const playTwice = costState.flags.playNextCardTwice;
  let nextState = executeCardPlayState(costState, card, index, effectiveCost, combatTexts, playTwice);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  if (playTwice) nextState = processEncounterTraitCardAction(nextState, card, combatTexts);

  const playerAlive = !isPlayerDefeated(nextState);
  if (playerAlive && enemyWasAlive) {
    nextState = applyResonantChimeTrinket(nextState, combatTexts);
  }
  nextState = handlePostPlayCardDestination(nextState, card, playerAlive, combatTexts);

  return { state: nextState, combatTexts };
}

export function hasDamageEffect(effects: ReadonlyArray<BattleCard["effects"][number]>): boolean {
  for (const effect of effects) {
    if (
      effect.kind === "damage" ||
      effect.kind === "random-damage" ||
      effect.kind === "cleanse-player-status-to-damage"
    ) {
      return true;
    }
    if (
      effect.kind === "chance" &&
      (hasDamageEffect(effect.successEffects) || hasDamageEffect(effect.failureEffects))
    ) {
      return true;
    }
    if (effect.kind === "repeat-over-turns" && hasDamageEffect(effect.effects)) {
      return true;
    }
  }
  return false;
}

export function isAttackCard(card: Pick<BattleCard, "effects">): boolean {
  return hasDamageEffect(card.effects);
}

export function enemyAttackDealsDamage(effects: readonly EnemyAttackEffect[] | null | undefined): boolean {
  return (effects ?? []).some((effect) => effect.kind === "damage");
}
