import {
  canPlayCard,
  getEffectiveDamageScore,
  getImmediateDefense,
  pickHighestScoring,
  type BattleSnapshot,
  type CardPlayOptions,
} from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data";
import { HALF_DIVISOR } from "@/lib/game-constants";

import { PLAYABLE_HAND_OPTIONS } from "../../shared/config/battle-input";
export { PLAYABLE_HAND_OPTIONS };

export function findFirstPlayableHandCard(
  state: BattleSnapshot,
  options: CardPlayOptions = PLAYABLE_HAND_OPTIONS,
): { card: BattleCard; index: number } | null {
  return getPlayableHandCards(state, options)[0] ?? null;
}

export function handHasPlayableCard(state: BattleSnapshot, options: CardPlayOptions = PLAYABLE_HAND_OPTIONS): boolean {
  return findFirstPlayableHandCard(state, options) !== null;
}

function getPlayableHandCards(
  state: BattleSnapshot,
  options: CardPlayOptions = PLAYABLE_HAND_OPTIONS,
): Array<{ card: BattleCard; index: number }> {
  const playable: Array<{ card: BattleCard; index: number }> = [];
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (canPlayCard(state, card, index, options)) {
      playable.push({ card, index });
    }
  }
  return playable;
}

function immediateSelfDamage(effects: readonly BattleCardEffect[]): number {
  return effects.reduce((total, effect) => {
    if (effect.kind === "lose-health" || effect.kind === "self-damage") return total + effect.amount;
    if (effect.kind === "chance")
      return total + Math.max(immediateSelfDamage(effect.successEffects), immediateSelfDamage(effect.failureEffects));
    return total;
  }, 0);
}

function hasPotentialLethalSelfCost(card: BattleCard, state: BattleSnapshot): boolean {
  return (
    state.deathsDoorUsed &&
    !state.deathsDoorActive &&
    state.playerStatuses.phoenixFeather <= 0 &&
    immediateSelfDamage(card.effects) >= state.playerHealth
  );
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
  // Leave potentially lethal card costs to manual play, including costs after
  // an attack and self-damage that defenses might mitigate.
  const playable = getPlayableHandCards(state, options).filter(({ card }) => !hasPotentialLethalSelfCost(card, state));
  if (playable.length === 0) return null;
  if (state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR) {
    const defensive = playable.filter(({ card }) => getImmediateDefense(card, state) > 0);
    if (defensive.length > 0) {
      return pickHighestScoring(defensive, (card) => getEffectiveDamageScore(card, state));
    }
  }
  return pickHighestScoring(playable, (card) => getEffectiveDamageScore(card, state));
}

/** Greedy Wish pick: highest effective-damage score wins, ties go to the earliest option. */
export function findBestWishChoice(state: BattleSnapshot): BattleCard | null {
  const options = state.wishOptions;
  if (!options || options.length === 0) return null;
  const pairs = options.flatMap((card, index) => (card ? [{ card, index }] : []));
  const safePairs = pairs.filter(({ card }) => !hasPotentialLethalSelfCost(card, state));
  if (safePairs.length > 0)
    return pickHighestScoring(safePairs, (card) => getEffectiveDamageScore(card, state))?.card ?? null;
  return pickHighestScoring(pairs, (card) => getEffectiveDamageScore(card, state))?.card ?? null;
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
    if (canPlayCard(battleState, card, index, PLAYABLE_HAND_OPTIONS)) {
      keys.add(getHandCardKey(card, index));
    }
  }
  return keys;
}

export function getPlayableHandCardKeysExcludingHidden(
  battleState: BattleSnapshot,
  hiddenHandCardKeys: HiddenHandCardKeys,
  playableKeys?: Set<string>,
): Set<string> {
  const next = new Set(playableKeys ?? getPlayableHandCardKeys(battleState));
  for (const hiddenKey of hiddenHandCardKeys) {
    next.delete(hiddenKey);
  }
  return next;
}
