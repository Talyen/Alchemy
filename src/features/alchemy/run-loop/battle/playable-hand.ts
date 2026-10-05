import {
  canPlayCard,
  getEffectiveDamageScore,
  getImmediateDefense,
  pickHighestScoring,
  type BattleSnapshot,
  type CardPlayOptions,
} from "@/lib/battle";
import { getCardKeywords, type BattleCard } from "@/lib/game-data";
import type { BattleCardEffect } from "@/lib/game-data";
import { CAMPFIRE_HEAL_FRACTION, HALF_DIVISOR } from "@/lib/game-constants";

import { PLAYABLE_HAND_OPTIONS } from "../../shared/config/battle-input";
export { PLAYABLE_HAND_OPTIONS };

export function handHasPlayableCard(state: BattleSnapshot, options: CardPlayOptions = PLAYABLE_HAND_OPTIONS): boolean {
  return state.hand.some((card, index) => card && canPlayCard(state, card, index, options));
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
  const selfDamage = immediateSelfDamage(card.effects);
  if (selfDamage >= 0 && selfDamage * 2 < state.playerHealth) return false;

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
  if (state.playerStatuses.phoenixFeather <= 0) return selfDamage * (mayRepeat ? 2 : 1) >= state.playerHealth;
  const revivedHealth = Math.round(state.playerMaxHealth * CAMPFIRE_HEAL_FRACTION);
  const first = selfCostOutcomes(card.effects, [{ health: state.playerHealth, phoenixFeather: true }], revivedHealth);
  const outcomes = mayRepeat ? selfCostOutcomes(card.effects, first, revivedHealth) : first;
  return outcomes.some((outcome) => outcome.health <= 0);
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
  const defensive =
    state.playerHealth <= state.playerMaxHealth / HALF_DIVISOR
      ? playable.filter(({ card }) => getImmediateDefense(card, state) > 0)
      : [];
  return pickHighestScoring(defensive.length ? defensive : playable, (card) => getEffectiveDamageScore(card, state));
}

/** Greedy Wish pick: highest effective-damage score wins, ties go to the earliest option. */
export function findBestWishChoice(state: BattleSnapshot): BattleCard | null {
  const options = state.wishOptions;
  if (!options || options.length === 0) return null;
  const pairs = options.flatMap((card, index) => (card ? [{ card, index }] : []));
  const safePairs = pairs.filter(({ card }) => !hasPotentialLethalSelfCost(card, state));
  return (
    pickHighestScoring(safePairs.length ? safePairs : pairs, (card) => getEffectiveDamageScore(card, state))?.card ??
    null
  );
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
  return new Set(getPlayableHandCards(battleState).map(({ card, index }) => getHandCardKey(card, index)));
}
