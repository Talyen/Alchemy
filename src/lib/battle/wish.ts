/**
 * Wish card generation and wish effect resolution.
 * Depends on: @/lib/game-data, ../game-constants, ./draw, ./types, ./combat-text, ./status-effects.
 * Depended on by: ./apply-effects.
 */
import { cardLibrary } from "@/lib/game-data";
import type { BattleCard } from "@/lib/game-data/types";
import { drawCards, shuffleCards } from "./draw";
import { addGold, applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";
import { removeHarmfulPlayerStatuses } from "./status-effects";
import { PERCENT_DENOMINATOR, WISH_CHOICE_COUNT } from "../game-constants";

export function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount =
    WISH_CHOICE_COUNT + (Math.random() * PERCENT_DENOMINATOR < state.talentEffects.wishExtraChoiceChance ? 1 : 0);

  let candidates = cardLibrary.filter((candidate) => candidate.id !== card.id);

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

function applyWishHealthAndStatusTriggers(state: BattleState, combatTexts: CombatTextEvent[]): BattleState {
  let nextState = state;
  if (nextState.talentEffects.healthOnWish > 0) {
    nextState = applyPlayerHealing(nextState, nextState.talentEffects.healthOnWish);
    mergeCombatText(combatTexts, {
      target: "player",
      kind: "heal",
      stat: "health",
      amount: nextState.talentEffects.healthOnWish,
    });
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
    nextState = applyWishHealthAndStatusTriggers(nextState, combatTexts);
    nextState = applyWishDrawTriggers(nextState);
  }

  return nextState;
}
