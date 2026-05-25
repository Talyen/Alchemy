/**
 * Wish card generation and wish effect resolution.
 * Depends on: @/lib/game-data, ../game-constants, ./draw, ./types, ./combat-text, ./status-effects.
 * Depended on by: ./apply-effects.
 */
import { cardLibrary } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data/types";
import { drawCards, shuffleCards } from "./draw";
import { addGold, applyPlayerHealing, clampHealth, type BattleState, type CombatTextEvent } from "./types";
import { emitOverhealBlockText, mergeCombatText } from "./combat-text";
import { removeHarmfulPlayerStatuses } from "./status-effects";
import { PERCENT_DENOMINATOR, WISH_CHOICE_COUNT, MAX_HAND_SIZE, MIXED_POTION_CARD_ID } from "../game-constants";

const WISH_CRYSTAL_GOLD_CHANCE = 0.5;

export function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT + (state.rng() * PERCENT_DENOMINATOR < state.talentEffects.wishExtraChoiceChance ? 1 : 0);

  let candidates = cardLibrary.filter((candidate) => candidate.id !== card.id && candidate.id !== MIXED_POTION_CARD_ID);

  if (state.talentEffects.wishUndiscoveredCards && state.discoveredCardIds.length > 0) {
    const undiscovered = candidates.filter((c) => !state.discoveredCardIds.includes(c.id));
    if (undiscovered.length >= baseCount) {
      candidates = undiscovered;
    }
  }

  return shuffleCards(candidates).slice(0, baseCount);
}

function applyWishGoldTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.talentEffects.goldOnWish > 0) {
    nextState = addGold(nextState, nextState.talentEffects.goldOnWish);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.talentEffects.goldOnWish,
    });
  }
  if (nextState.talentEffects.goldOnWishAmount > 0) {
    nextState = addGold(nextState, nextState.talentEffects.goldOnWishAmount);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.talentEffects.goldOnWishAmount,
    });
  }
  if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
    nextState = addGold(nextState, nextState.trinketEffects.wishingWellGoldOnWish);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "status",
      stat: "gold",
      amount: nextState.trinketEffects.wishingWellGoldOnWish,
    });
  }
  return nextState;
}

function applyWishCrystalGoldTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const amount = state.talentEffects.wishCrystalGold;
  if (amount <= 0) return state;
  if (state.rng() < WISH_CRYSTAL_GOLD_CHANCE) {
    mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount });
    return addGold(state, amount);
  }
  mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "crystal", amount });
  return {
    ...state,
    pendingMaterials: { ...state.pendingMaterials, crystal: state.pendingMaterials.crystal + amount },
  };
}

function applyWishHealthAndStatusTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.talentEffects.healthOnWish > 0) {
    const prevState = nextState;
    nextState = applyPlayerHealing(nextState, nextState.talentEffects.healthOnWish);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: nextState.talentEffects.healthOnWish,
    });
    emitOverhealBlockText(prevState, nextState, combatTexts);
  }
  if (nextState.talentEffects.removeHarmfulStatusOnWish) {
    nextState = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
  }
  return nextState;
}

function applyWishDrawTriggers(state: BattleState): BattleState {
  let nextState = state;
  if (nextState.talentEffects.wishDrawsCard) {
    const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, 1, nextState.nextCardUid);
    nextState = {
      ...nextState,
      deck: draw.deck,
      discard: draw.discard,
      hand: draw.hand,
      nextCardUid: draw.nextCardUid,
    };
  }
  return nextState;
}

export function applyWishEffect(state: BattleState, card: BattleCard, amount: number, combatTexts: CombatTextEvent[]) {
  const wishCount = Math.max(0, Math.round(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions = Array.from({ length: wishCount }, () => buildWishOptions(state, card));
  let nextState: BattleState = state.wishOptions
    ? { ...state, wishQueue: [...state.wishQueue, ...nextWishOptions] }
    : { ...state, wishOptions: nextWishOptions[0], wishQueue: [...state.wishQueue, ...nextWishOptions.slice(1)] };

  for (let i = 0; i < wishCount; i += 1) {
    nextState = applyWishGoldTriggers(nextState, combatTexts);
    nextState = applyWishCrystalGoldTrigger(nextState, combatTexts);
    nextState = applyWishHealthAndStatusTriggers(nextState, combatTexts);
    nextState = applyWishDrawTriggers(nextState);
    nextState = applyWishBurnTrigger(nextState, combatTexts);
  }

  return nextState;
}

function applyWishBurnTrigger(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  const burnAmount = state.talentEffects.burnOnWish;
  if (burnAmount <= 0 || state.enemyHealth <= 0) return state;
  mergeCombatText(combatTexts, {
    target: "enemy",
    kind: "damage",
    stat: "burn",
    amount: burnAmount,
  });
  return {
    ...state,
    enemyHealth: clampHealth(state.enemyHealth, -burnAmount, state.enemyMaxHealth),
  };
}

export function chooseWishCard(state: BattleState, cardId: string) {
  const chosenCard = state.wishOptions?.find((card) => card.id === cardId);
  if (!chosenCard) {
    return state;
  }

  const [nextWishOptions = null, ...wishQueue] = state.wishQueue;

  if (state.hand.length < MAX_HAND_SIZE) {
    return { ...state, hand: [...state.hand, chosenCard], wishOptions: nextWishOptions, wishQueue };
  }

  return { ...state, discard: [...state.discard, chosenCard], wishOptions: nextWishOptions, wishQueue };
}
