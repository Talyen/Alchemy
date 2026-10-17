import {
  canPlayCard,
  getEffectiveDamageScore,
  getImmediateDefense,
  type BattleSnapshot,
  type CardPlayOptions,
} from "@/lib/battle";
import { getCardKeywords, visitBattleCardEffects, type BattleCard } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION, HALF_DIVISOR } from "@/lib/game-constants";

import { PLAYABLE_HAND_OPTIONS } from "../../shared/config/battle-input";
export { PLAYABLE_HAND_OPTIONS };

export function handHasPlayableCard(state: BattleSnapshot, options: CardPlayOptions = PLAYABLE_HAND_OPTIONS): boolean {
  return state.hand.some((card, index) => card && canPlayCard(state, card, index, options));
}

interface SelfCostOutcome {
  health: number;
  phoenixFeather: boolean;
}

/** Conservatively ignore healing and mitigation, but spend death prevention once in effect order. */
function selfCostOutcomes(
  effects: readonly BattleCardEffect[],
  outcomes: SelfCostOutcome[],
  revivedHealth: number,
): SelfCostOutcome[] {
  for (const effect of effects) {
    if (effect.kind === "lose-health" || effect.kind === "self-damage") {
      outcomes = outcomes.map((outcome) => {
        if (outcome.health <= 0 || effect.amount <= 0) return outcome;
        if (effect.amount >= outcome.health && outcome.phoenixFeather) {
          return { health: revivedHealth, phoenixFeather: false };
        }
        return { ...outcome, health: Math.max(0, outcome.health - effect.amount) };
      });
    } else if (effect.kind === "chance") {
      const branches = [
        ...(effect.probability > 0 ? selfCostOutcomes(effect.successEffects, outcomes, revivedHealth) : []),
        ...(effect.probability < 1 ? selfCostOutcomes(effect.failureEffects, outcomes, revivedHealth) : []),
      ];
      // At most two meaningful worst cases: Feather retained or already spent.
      outcomes = [false, true].flatMap((phoenixFeather) => {
        const matching = branches.filter((outcome) => outcome.phoenixFeather === phoenixFeather);
        return matching.length
          ? [{ health: Math.min(...matching.map((outcome) => outcome.health)), phoenixFeather }]
          : [];
      });
    }
  }
  return outcomes;
}

function hasPotentialLethalSelfCost(card: BattleCard, state: BattleSnapshot): boolean {
  // Feather revival ends Death's Door protection before any remaining costs.
  if (!state.deathsDoorUsed || (state.deathsDoorActive && state.playerStatuses.phoenixFeather <= 0)) return false;
  if (!visitBattleCardEffects(card.effects, (effect) => effect.kind === "lose-health" || effect.kind === "self-damage"))
    return false;
  const revivedHealth = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
  const first = selfCostOutcomes(
    card.effects,
    [{ health: state.playerHealth, phoenixFeather: state.playerStatuses.phoenixFeather > 0 }],
    revivedHealth,
  );
  if (first.some((outcome) => outcome.health <= 0)) return true;

  const keywords = getCardKeywords(card);
  const mayRepeat =
    state.flags.playNextCardTwice ||
    keywords.some((keyword) => {
      if (keyword === "burn") return state.talentEffects.burnCardPlayTwiceChance > 0;
      if (keyword === "freeze") return state.talentEffects.freezeCardPlayTwiceChance > 0;
      if (keyword === "nature") return state.talentEffects.natureCardPlayTwiceChance > 0;
      if (keyword === "poison") return state.talentEffects.poisonCardPlayTwiceChance > 0;
      if (keyword === "stun") return state.talentEffects.stunCardPlayTwiceChance > 0;
      if (keyword === "wish") return state.talentEffects.wishCardPlayTwiceChance > 0;
      return false;
    });
  return mayRepeat && selfCostOutcomes(card.effects, first, revivedHealth).some((outcome) => outcome.health <= 0);
}

/**
 * Greedy autoplay pick: highest effective-damage score wins, with ties going
 * to the leftmost card. At half health or below, the pick is restricted to
 * defensive cards when any are playable (deterministic form of the balance
 * simulator's defensive bias — no RNG draw, so the run stream is untouched).
 */
export function findBestPlayableHandCard(
  state: BattleSnapshot,
  options: CardPlayOptions = PLAYABLE_HAND_OPTIONS,
): { card: BattleCard; index: number } | null {
  let best: { card: BattleCard; index: number } | null = null;
  let bestScore = -Infinity;
  let hasDefense = false;
  const seekDefense = state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR;
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (!canPlayCard(state, card, index, options) || hasPotentialLethalSelfCost(card, state)) continue;
    const defensive = seekDefense && getImmediateDefense(card, state) > 0;
    if (hasDefense && !defensive) continue;
    const score = getEffectiveDamageScore(card, state);
    if (!best || (defensive && !hasDefense) || score > bestScore) {
      best = { card, index };
      bestScore = score;
      hasDefense = defensive;
    }
  }
  return best;
}

/** Prefer safe Wish choices, retaining offer order on equal scores. */
export function findBestWishChoice(state: BattleSnapshot): BattleCard | null {
  let best: BattleCard | null = null;
  let bestScore = -Infinity;
  let hasSafeChoice = false;
  for (const card of state.wishOptions ?? []) {
    if (!card) continue;
    const safe = !hasPotentialLethalSelfCost(card, state);
    if (hasSafeChoice && !safe) continue;
    const score = getEffectiveDamageScore(card, state);
    if (!best || (safe && !hasSafeChoice) || score > bestScore) {
      best = card;
      bestScore = score;
      hasSafeChoice = safe;
    }
  }
  return best;
}

export function getHandCardKey(card: BattleCard, index?: number): string {
  if (card.uid !== undefined) return `${card.id}-${card.uid}`;
  if (index !== undefined) return `${card.id}-no-uid-${index}`;
  return `${card.id}-no-uid`;
}

export type HiddenHandCardKeys = readonly string[];

export const EMPTY_HIDDEN_HAND_KEYS: HiddenHandCardKeys = Object.freeze([]);

export function canonicalizeHiddenHandCardKeys(keys: Iterable<string>): HiddenHandCardKeys {
  const unique = [...new Set(keys)];
  if (unique.length === 0) return EMPTY_HIDDEN_HAND_KEYS;
  unique.sort();
  return Object.freeze(unique);
}

export function hiddenHandKeysEqual(a: HiddenHandCardKeys, b: HiddenHandCardKeys): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function handHasHiddenCard(
  state: Pick<BattleSnapshot, "hand">,
  hiddenHandCardKeys: HiddenHandCardKeys,
): boolean {
  if (hiddenHandCardKeys.length === 0) return false;
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (hiddenHandCardKeys.includes(getHandCardKey(card, index))) return true;
  }
  return false;
}

export function getPlayableHandCardKeys(battleState: BattleSnapshot): Set<string> {
  const keys = new Set<string>();
  for (let index = 0; index < battleState.hand.length; index++) {
    const card = battleState.hand[index];
    if (!card) continue;
    if (canPlayCard(battleState, card, index, PLAYABLE_HAND_OPTIONS)) keys.add(getHandCardKey(card, index));
  }
  return keys;
}
