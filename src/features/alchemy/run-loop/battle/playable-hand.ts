import { canPlayCard, type BattleState, type CardPlayOptions } from "@/lib/battle";
import type { BattleCard } from "@/lib/game-data";

export const PLAYABLE_HAND_OPTIONS: CardPlayOptions = { allowAfterEnemyDefeat: true };

export function findFirstPlayableHandCard(
  state: BattleState,
  options: CardPlayOptions = PLAYABLE_HAND_OPTIONS,
): { card: BattleCard; index: number } | null {
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (canPlayCard(state, card, index, options)) {
      return { card, index };
    }
  }
  return null;
}

export function handHasPlayableCard(state: BattleState, options: CardPlayOptions = PLAYABLE_HAND_OPTIONS): boolean {
  return findFirstPlayableHandCard(state, options) !== null;
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

export function handHasHiddenCard(state: BattleState, hiddenHandCardKeys: HiddenHandCardKeys): boolean {
  if (hiddenHandCardKeys.length === 0) return false;
  for (let index = 0; index < state.hand.length; index++) {
    const card = state.hand[index];
    if (!card) continue;
    if (hiddenHandCardKeys.includes(getHandCardKey(card, index))) return true;
  }
  return false;
}

export function getPlayableHandCardKeys(battleState: BattleState): Set<string> {
  const keys: string[] = [];
  for (let index = 0; index < battleState.hand.length; index++) {
    const card = battleState.hand[index];
    if (!card) continue;
    if (canPlayCard(battleState, card, index, PLAYABLE_HAND_OPTIONS)) {
      keys.push(getHandCardKey(card, index));
    }
  }
  return new Set(keys);
}

export function getPlayableHandCardKeysExcludingHidden(
  battleState: BattleState,
  hiddenHandCardKeys: HiddenHandCardKeys,
  cardTransferInProgress = false,
  playableKeys?: Set<string>,
): Set<string> {
  if (cardTransferInProgress) return new Set();
  const next = new Set(playableKeys ?? getPlayableHandCardKeys(battleState));
  for (const hiddenKey of hiddenHandCardKeys) {
    next.delete(hiddenKey);
  }
  return next;
}
