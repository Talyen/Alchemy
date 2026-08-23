/**
 * Resolves card play validation, cost reduction, and effect application during combat.
 * Depends on: ./draw, ./effect-handlers, ./combat-text, ../game-constants, @/lib/game-data, ./types.
 * Depended on by: features/alchemy controllers.
 */
import { drawFromState, applyDrawResult } from "./draw";
import { applyCardEffects } from "./effect-handlers";
import {
  addGoldWithCombatText,
  addPlayerStatusWithCombatText,
  applyHealingWithCombatText,
  gainManaWithCombatText,
  mergeCombatText,
} from "./combat-text";
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
import { rollPercent } from "./status-helpers";

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
 * `playTwice` must be resolved by the caller before the hand/flags reset performed here.
 */
function executeCardPlayState(
  state: BattleState,
  card: BattleCard,
  index: number,
  effectiveCost: number,
  combatTexts: CombatTextEvent[],
  playTwice: boolean,
): BattleState {
  const consumeCrit = state.flags.nextHitCrit && cardDealsDamage(card);
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
  // Replay shares the first application's context so start-of-play conditionals
  // (e.g. restore-mana ifEnemyFrozen) compare against the same pre-play snapshot.
  if (playTwice) nextState = applyCardEffects(nextState, card, combatTexts, playContext);
  if (consumeCrit) nextState = { ...nextState, flags: { ...nextState.flags, nextHitCrit: false } };

  nextState = applyNatureCardPlayTalents(nextState, card, combatTexts);

  if (cardHasDamageType(card, "nature") && state.gearEffects.manaOnNatureDamageChance > 0) {
    if (rollPercent(state.gearEffects.manaOnNatureDamageChance, state.rng)) {
      nextState = gainManaWithCombatText(nextState, 1, combatTexts);
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
    // At full mana the chime holds its charge instead of wasting it.
    const afterMana = gainManaWithCombatText(state, resonantChimeMana, combatTexts);
    if (afterMana.mana <= state.mana) return state;
    return { ...afterMana, flags: { ...state.flags, resonantChimeUsedThisTurn: true } };
  }
  return state;
}

function applyNatureCardPlayTalents(state: BattleState, card: BattleCard, combatTexts: CombatTextEvent[]): BattleState {
  if (!cardHasDamageType(card, "nature")) return state;
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

/**
 * Coordinates cost checks, play validation, effect dispatching, and deck movement.
 * Validation is owned by canPlayCard; this function trusts its verdict.
 */
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

  // Single resolution point for replay; both the effect application and the
  // encounter-trait pass consume this decision.
  const playTwice = costState.flags.playNextCardTwice;
  let nextState = executeCardPlayState(costState, card, index, effectiveCost, combatTexts, playTwice);
  nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  if (playTwice) nextState = processEncounterTraitCardAction(nextState, card, combatTexts);
  // Chime only grants mana, so survival cannot change across it.
  const playerAlive = !isPlayerDefeated(nextState);
  if (playerAlive && enemyWasAlive) {
    nextState = applyResonantChimeTrinket(nextState, combatTexts);
  }
  nextState = handlePostPlayCardDestination(nextState, card, playerAlive, combatTexts);

  return { state: nextState, combatTexts };
}
