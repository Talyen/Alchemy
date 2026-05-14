// Wish card generation and wish effect resolution.
import { cardLibrary, type BattleCard } from "@/lib/game-data";
import { drawCards, shuffleCards } from "./draw";
import { applyPlayerHealing, type BattleState, type CombatTextEvent } from "./types";
import { mergeCombatText } from "./combat-text";
import { removeHarmfulPlayerStatuses } from "./status-effects";
import { PERCENT_DENOMINATOR, WISH_CHOICE_COUNT } from "../game-constants";

export function buildWishOptions(state: BattleState, card: BattleCard): BattleCard[] {
  const baseCount = WISH_CHOICE_COUNT + (Math.random() * PERCENT_DENOMINATOR < state.talentEffects.wishExtraChoiceChance ? 1 : 0);

  let candidates = cardLibrary.filter((candidate) => candidate.id !== card.id);

  if (state.talentEffects.wishUndiscoveredCards && state.discoveredCardIds.length > 0) {
    const undiscovered = candidates.filter((c) => !state.discoveredCardIds.includes(c.id));
    if (undiscovered.length >= baseCount) {
      candidates = undiscovered;
    }
  }

  return shuffleCards(candidates).slice(0, baseCount);
}

export function applyWishEffect(state: BattleState, card: BattleCard, amount: number, combatTexts: CombatTextEvent[]) {
  const wishCount = Math.max(0, Math.floor(amount));
  if (wishCount <= 0) return state;

  const nextWishOptions = Array.from({ length: wishCount }, () => buildWishOptions(state, card));
  let nextState: BattleState = state.wishOptions
    ? { ...state, wishQueue: [...state.wishQueue, ...nextWishOptions] }
    : { ...state, wishOptions: nextWishOptions[0], wishQueue: [...state.wishQueue, ...nextWishOptions.slice(1)] };

  for (let i = 0; i < wishCount; i += 1) {
    if (nextState.talentEffects.goldOnWish > 0) {
      nextState = { ...nextState, gold: nextState.gold + nextState.talentEffects.goldOnWish };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnWish });
    }
    if (nextState.talentEffects.goldOnWishAmount > 0) {
      nextState = { ...nextState, gold: nextState.gold + nextState.talentEffects.goldOnWishAmount };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.talentEffects.goldOnWishAmount });
    }
    if (nextState.trinketEffects.wishingWellGoldOnWish > 0) {
      nextState = { ...nextState, gold: nextState.gold + nextState.trinketEffects.wishingWellGoldOnWish };
      mergeCombatText(combatTexts, { target: "player", kind: "status", stat: "gold", amount: nextState.trinketEffects.wishingWellGoldOnWish });
    }
    if (nextState.talentEffects.healthOnWish > 0) {
      nextState = applyPlayerHealing(nextState, nextState.talentEffects.healthOnWish);
      mergeCombatText(combatTexts, { target: "player", kind: "heal", stat: "health", amount: nextState.talentEffects.healthOnWish });
    }
    if (nextState.talentEffects.removeHarmfulStatusOnWish) {
      nextState = removeHarmfulPlayerStatuses(nextState, 1, combatTexts);
    }
    if (nextState.talentEffects.wishDrawsCard) {
      const draw = drawCards(nextState.deck, nextState.discard, nextState.hand, 1, nextState.nextCardUid);
      nextState = { ...nextState, deck: draw.deck, discard: draw.discard, hand: draw.hand, nextCardUid: draw.nextCardUid };
    }
  }

  return nextState;
}
