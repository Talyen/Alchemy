/**
 * Resolves card play validation, cost reduction, and effect application during combat.
 * Depends on: ./draw, ./effect-handlers, ./combat-text, ../game-constants, @/lib/game-data, ./types.
 * Depended on by: features/alchemy controllers.
 */
import { drawFromState } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import { mergeCombatText } from "./combat-text";
import { type BattleCard } from "@/lib/game-data";
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

import { cardHasDamageType, computeEffectiveCost } from "./card-cost-rules";

/**
 * Resolves the final state and cost for a played card, modifying flags if discounts were used.
 */
function resolveCardPlayCost(state: BattleState, card: BattleCard) {
  const { effectiveCost, consumedFlags } = computeEffectiveCost(state, card);
  if (consumedFlags.size === 0) {
    return { state, effectiveCost };
  }
  let nextFlags: CombatFlags = { ...state.flags };
  for (const flag of consumedFlags) {
    nextFlags = { ...nextFlags, [flag]: true };
  }
  return { state: { ...state, flags: nextFlags }, effectiveCost };
}

/**
 * Validates whether a card in the player's hand can currently be played.
 */
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

function effectDealsDamageToEnemy(effect: BattleCard["effects"][number]): boolean {
  if (
    effect.kind === "damage" ||
    effect.kind === "random-damage" ||
    effect.kind === "cleanse-player-status-to-damage"
  ) {
    return true;
  }
  if (effect.kind === "chance") {
    return [...effect.successEffects, ...effect.failureEffects].some(effectDealsDamageToEnemy);
  }
  return false;
}

function cardDealsDamage(card: BattleCard): boolean {
  return card.effects.some(effectDealsDamageToEnemy);
}

function canAffordCard(state: BattleState, index: number): boolean {
  const currentCard = state.hand[index];
  return !!currentCard && state.mana >= computeEffectiveCost(state, currentCard).effectiveCost;
}

/** Battle-engine playability (mana, phase, defeat, wish). UI adds screen/animation guards on top. */
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

/**
 * Executes state changes directly related to removing a card from hand and applying its effects.
 */
function executeCardPlayState(
  state: BattleState,
  card: BattleCard,
  index: number,
  effectiveCost: number,
  combatTexts: CombatTextEvent[],
): BattleState {
  const playTwice = state.flags.playNextCardTwice;
  const consumeCrit = state.flags.nextHitCrit && cardDealsDamage(card);
  let nextState: BattleState = {
    ...state,
    hand: state.hand.filter((_, i) => i !== index),
    flags: { ...state.flags, nextCardCostReduction: 0, playNextCardTwice: false },
    cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
    mana: Math.max(0, state.mana - effectiveCost),
  };

  nextState = applyCardEffects(nextState, card, combatTexts);
  if (playTwice) nextState = applyCardEffects(nextState, card, combatTexts);
  if (consumeCrit) nextState = { ...nextState, flags: { ...nextState.flags, nextHitCrit: false } };

  if (cardHasDamageType(card, "nature") && state.gearEffects.manaOnNatureDamageChance > 0) {
    if (state.rng() * 100 < state.gearEffects.manaOnNatureDamageChance) {
      const nextMana = Math.min(nextState.maxMana, nextState.mana + 1);
      const gained = nextMana - nextState.mana;
      if (gained > 0) {
        mergeCombatText(combatTexts, {
          target: "player",
          kind: "status",
          stat: "mana",
          amount: gained,
        });
        nextState = { ...nextState, mana: nextMana };
      }
    }
  }

  return nextState;
}

/**
 * Applies the Resonant Chime boon effect if cards played trigger criteria.
 */
function applyResonantChimeTrinket(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const { resonantChimeCardsRequired, resonantChimeMana } = state.trinketEffects;
  if (
    resonantChimeCardsRequired > 0 &&
    resonantChimeMana > 0 &&
    // Ensure the chime triggers at most once per player turn
    !state.flags.resonantChimeUsedThisTurn &&
    state.cardsPlayedThisTurn >= resonantChimeCardsRequired
  ) {
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "mana",
      amount: resonantChimeMana,
    });
    return {
      ...state,
      mana: state.mana + resonantChimeMana,
      flags: { ...state.flags, resonantChimeUsedThisTurn: true },
    };
  }
  return state;
}

/**
 * Resolves post-play destination (exhausted/discard pile) and triggers consume riders.
 */
function handlePostPlayCardDestination(
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
          ...nextState,
          deck: draw.deck,
          discard: draw.discard,
          hand: draw.hand,
          nextCardUid: draw.nextCardUid,
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
    }
    return nextState;
  }
  return { ...state, discard: [...state.discard, card] };
}

/**
 * Coordinates cost checks, play validation, effect dispatching, and deck movement.
 */
export function playBattleCardResolved(
  state: BattleState,
  cardId: string,
  index: number,
  options?: CardPlayOptions,
): BattleResolution {
  const combatTexts: CombatTextEvent[] = [];
  const enemyWasAlive = state.enemyHealth > 0;

  if (!options?.allowAfterEnemyDefeat && state.enemyHealth <= 0) {
    return { state, combatTexts };
  }
  if (isPlayerDefeated(state)) {
    return { state, combatTexts };
  }

  const card = getPlayableCard(state, cardId, index);
  if (!card) return { state, combatTexts };
  if (!canPlayCard(state, card, index, options)) return { state, combatTexts };

  const { state: costState, effectiveCost } = resolveCardPlayCost(state, card);
  if (costState.mana < effectiveCost) {
    return { state, combatTexts };
  }

  const playTwice = costState.flags.playNextCardTwice;
  let nextState = executeCardPlayState(costState, card, index, effectiveCost, combatTexts);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  if (playTwice) nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  if (!isPlayerDefeated(nextState)) {
    if (enemyWasAlive) {
      nextState = applyResonantChimeTrinket(nextState, combatTexts);
    }
  }
  nextState = handlePostPlayCardDestination(nextState, card, !isPlayerDefeated(nextState), combatTexts);

  return { state: nextState, combatTexts };
}
